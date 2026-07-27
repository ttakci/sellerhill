import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AssistantConversationMode, AssistantConversationStatus, AssistantMessageAuthorType, AssistantMessageStatus, AssistantMessageType, AssistantParticipantRole, SupportAgentAvailability, SupportAssignmentStatus, SupportAuditAction, SupportQueueFilter, SupportTransferKind, UserRole, UserStatus, type JwtPayload } from '@repo/shared';
import type { PoolClient } from 'pg';

import { DatabaseService } from '../../common/database/database.service';
import { AssistantConversationRepository } from '../assistant/repositories/assistant-conversation.repository';

import { SupportConversationRepository } from './repositories/support-conversation.repository';
import { SupportPresenceService } from './support-presence.service';

const DEFAULT_CAPACITY = 5;

interface SupportVisibleConversationRow {
  id: string;
  status: AssistantConversationStatus;
  mode: AssistantConversationMode;
  assigned_support_user_id: string | null;
  last_sequence: string;
}

interface SupportMessageRow {
  id: string;
  sequence: string;
  author_type: AssistantMessageAuthorType;
  author_user_id: string | null;
  message_type: AssistantMessageType;
  status: AssistantMessageStatus;
  content: string;
  created_at: Date;
  completed_at: Date | null;
}

interface SupportEligibleAgentRow {
  id: string;
  first_name: string;
  last_name: string;
  capacity: number;
  active_assignments: number;
}

@Injectable()
export class SupportService {
  constructor(private readonly database: DatabaseService, private readonly support: SupportConversationRepository,
    private readonly conversations: AssistantConversationRepository, private readonly presence: SupportPresenceService) {}

  private async authority(client: PoolClient, actor: JwtPayload): Promise<void> {
    const result = await client.query<{ role: UserRole; session_version: number; status: UserStatus }>(
      'SELECT role,session_version,status FROM users WHERE id=$1 FOR SHARE', [actor.sub]);
    const row = result.rows[0];
    if (!row || row.role !== UserRole.SUPPORT || row.session_version !== actor.sessionVersion || row.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('auth.errors.forbidden');
    }
  }

  async list(actor: JwtPayload, filter: SupportQueueFilter, search: string | undefined, limit: number) {
    return this.database.transaction(async (client) => {
      await this.authority(client, actor);
      const params: unknown[] = [actor.sub, AssistantConversationStatus.DELETED, Math.min(limit, 100)];
      const clauses = ['c.status<>$2'];
      if (filter === SupportQueueFilter.WAITING) { params.push(AssistantConversationMode.WAITING_FOR_SUPPORT); clauses.push(`c.mode=$${params.length}`); }
      if (filter === SupportQueueFilter.ASSIGNED_TO_ME) { clauses.push('c.assigned_support_user_id=$1'); }
      if (filter === SupportQueueFilter.OPEN) { params.push(AssistantConversationStatus.OPEN); clauses.push(`c.status=$${params.length}`); }
      if (filter === SupportQueueFilter.RESOLVED) { params.push(AssistantConversationStatus.RESOLVED); clauses.push(`c.status=$${params.length}`); }
      if (search?.trim()) { params.push(`%${search.trim()}%`); clauses.push(`(c.title ILIKE $${params.length} OR EXISTS(SELECT 1 FROM assistant_messages m WHERE m.conversation_id=c.id AND m.content ILIKE $${params.length}))`); }
      const rows = await client.query<SupportVisibleConversationRow & { title: string | null; support_requested_at: Date | null; last_message_at: Date; preview: string | null }>(`SELECT c.id,c.title,c.mode,c.status,c.support_requested_at,c.last_message_at,c.assigned_support_user_id,
        (SELECT content FROM assistant_messages m WHERE m.conversation_id=c.id AND m.author_type=$${params.length + 1} ORDER BY sequence DESC LIMIT 1) preview
        FROM assistant_conversations c WHERE ${clauses.join(' AND ')} ORDER BY c.last_message_at DESC,c.id DESC LIMIT $3`,
      [...params, AssistantMessageAuthorType.CUSTOMER]);
      await this.audit(client, actor.sub, null, SupportAuditAction.QUEUE_PREVIEWED);
      return rows.rows;
    });
  }

  async detail(actor: JwtPayload, id: string) { return this.withVisible(actor, id, true, async (client, row) => {
    const messages = await client.query<SupportMessageRow>('SELECT id,sequence,author_type,author_user_id,message_type,status,content,created_at,completed_at FROM assistant_messages WHERE conversation_id=$1 AND deleted_at IS NULL ORDER BY sequence', [id]);
    await this.audit(client, actor.sub, id, SupportAuditAction.CONVERSATION_OPENED);
    return { conversation: row, messages: messages.rows };
  }); }

  async claim(actor: JwtPayload, id: string) { return this.database.transaction(async (client) => {
    await this.authority(client, actor); await this.assertCapacity(client, actor.sub);
    const row = await this.support.claim(client, actor.sub, id);
    if (!row) {throw new ConflictException('support.errors.conversationAlreadyClaimed');}
    await this.audit(client, actor.sub, id, SupportAuditAction.CLAIMED); return row;
  }); }

  async release(actor: JwtPayload, id: string) { return this.assignedMutation(actor, id, async (client) => {
    if (!await this.support.release(client, actor.sub, id, SupportAssignmentStatus.RELEASED)) {throw new ConflictException();}
    await this.audit(client, actor.sub, id, SupportAuditAction.RELEASED); return { success: true };
  }); }

  async transfer(actor: JwtPayload, id: string, kind: SupportTransferKind, target?: string) {
    if (kind === SupportTransferKind.QUEUE) {return this.release(actor, id);}
    if (!target) {throw new ConflictException();}
    return this.assignedMutation(actor, id, async (client) => {
      await this.assertEligibleTarget(client, target);
      await client.query('UPDATE support_assignments SET status=$2,released_at=NOW(),release_reason=$3,updated_at=NOW() WHERE conversation_id=$1 AND status=$4', [id, SupportAssignmentStatus.TRANSFERRED, SupportTransferKind.AGENT, SupportAssignmentStatus.ACTIVE]);
      await client.query('UPDATE assistant_conversation_participants SET left_at=NOW(),updated_at=NOW() WHERE conversation_id=$1 AND user_id=$2 AND left_at IS NULL', [id, actor.sub]);
      await client.query('UPDATE assistant_conversations SET assigned_support_user_id=$2,support_claimed_at=NOW(),version=version+1,updated_at=NOW() WHERE id=$1', [id, target]);
      await client.query('INSERT INTO support_assignments(conversation_id,support_user_id,status) VALUES($1,$2,$3)', [id, target, SupportAssignmentStatus.ACTIVE]);
      await client.query('INSERT INTO assistant_conversation_participants(conversation_id,user_id,participant_role) VALUES($1,$2,$3)', [id, target, AssistantParticipantRole.SUPPORT_AGENT]);
      await this.audit(client, actor.sub, id, SupportAuditAction.TRANSFERRED, target); return { success: true };
    });
  }

  async reply(actor: JwtPayload, id: string, clientMessageId: string, content: string) { return this.assignedMutation(actor, id, async (client, row) => {
    const duplicate = await client.query<SupportMessageRow>('SELECT id,sequence,author_type,author_user_id,message_type,status,content,created_at,completed_at FROM assistant_messages WHERE conversation_id=$1 AND client_message_id=$2', [id, clientMessageId]);
    if (duplicate.rows[0]) {return duplicate.rows[0];}
    const sequence = BigInt(row.last_sequence) + 1n;
    const inserted = await client.query<SupportMessageRow>(`INSERT INTO assistant_messages(conversation_id,sequence,client_message_id,author_type,author_user_id,message_type,status,content,completed_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW()) RETURNING *`, [id, sequence.toString(), clientMessageId, AssistantMessageAuthorType.SUPPORT_AGENT, actor.sub, AssistantMessageType.TEXT, AssistantMessageStatus.COMPLETED, content.trim()]);
    await client.query('UPDATE assistant_conversations SET last_sequence=$2,last_message_at=NOW(),version=version+1,updated_at=NOW() WHERE id=$1', [id, sequence.toString()]);
    await this.audit(client, actor.sub, id, SupportAuditAction.MESSAGE_SENT); return inserted.rows[0];
  }); }

  async read(actor: JwtPayload, id: string, sequence: string) { return this.withVisible(actor, id, false, async (client) => {
    await client.query(`UPDATE assistant_conversation_participants p SET last_read_sequence=GREATEST(last_read_sequence,LEAST($3::bigint,c.last_sequence)),last_read_at=NOW(),updated_at=NOW()
      FROM assistant_conversations c WHERE p.conversation_id=c.id AND c.id=$1 AND p.user_id=$2`, [id, actor.sub, sequence]);
    await this.audit(client, actor.sub, id, SupportAuditAction.MARKED_READ); return { success: true };
  }); }

  resolve(actor: JwtPayload, id: string) { return this.transition(actor, id, SupportAuditAction.RESOLVED, AssistantConversationMode.AI, AssistantConversationStatus.RESOLVED, SupportAssignmentStatus.RESOLVED); }
  returnToAi(actor: JwtPayload, id: string) { return this.transition(actor, id, SupportAuditAction.RETURNED_TO_AI, AssistantConversationMode.AI, AssistantConversationStatus.OPEN, SupportAssignmentStatus.RETURNED_TO_AI); }
  async reopenSupport(actor: JwtPayload, id: string) { return this.withVisible(actor, id, false, async (client, row) => {
    if (row.status !== AssistantConversationStatus.RESOLVED) {throw new ConflictException();}
    await client.query('UPDATE assistant_conversations SET status=$2,mode=$3,support_requested_at=NOW(),resolved_at=NULL,version=version+1,updated_at=NOW() WHERE id=$1', [id, AssistantConversationStatus.OPEN, AssistantConversationMode.WAITING_FOR_SUPPORT]);
    await this.audit(client, actor.sub, id, SupportAuditAction.REOPENED_SUPPORT); return { success: true };
  }); }

  async setPreference(actor: JwtPayload, availability: SupportAgentAvailability) { return this.database.transaction(async (client) => {
    await this.authority(client, actor); await client.query('INSERT INTO support_profiles(user_id,availability) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET availability=$2,updated_at=NOW()', [actor.sub, availability]);
    return { availability };
  }); }
  async heartbeat(actor: JwtPayload, connectionId: string) { return this.database.transaction(async (client) => {
    await this.authority(client, actor); const profile = await client.query<{ availability: SupportAgentAvailability }>('SELECT availability FROM support_profiles WHERE user_id=$1', [actor.sub]);
    return this.presence.heartbeat(actor.sub, connectionId, profile.rows[0]?.availability ?? SupportAgentAvailability.AVAILABLE);
  }); }
  async eligible(actor: JwtPayload) { return this.database.transaction(async (client) => {
    await this.authority(client, actor); const result = await client.query<SupportEligibleAgentRow>(`SELECT u.id,u.first_name,u.last_name,sp.capacity,COUNT(sa.id)::int active_assignments FROM users u JOIN support_profiles sp ON sp.user_id=u.id LEFT JOIN support_assignments sa ON sa.support_user_id=u.id AND sa.status=$2 WHERE u.role=$1 AND u.id<>$3 GROUP BY u.id,sp.capacity HAVING COUNT(sa.id)<sp.capacity`, [UserRole.SUPPORT, SupportAssignmentStatus.ACTIVE, actor.sub]);
    const eligible: Array<SupportEligibleAgentRow & { presence: Awaited<ReturnType<SupportPresenceService['get']>> }> = []; for (const row of result.rows) { const state = await this.presence.get(row.id); if (state.availability === SupportAgentAvailability.AVAILABLE && state.connectionCount > 0) {eligible.push({ ...row, presence: state });} } return eligible;
  }); }

  private async transition(actor: JwtPayload, id: string, action: SupportAuditAction, mode: AssistantConversationMode, status: AssistantConversationStatus, assignmentStatus: SupportAssignmentStatus) { return this.assignedMutation(actor, id, async (client) => {
    await client.query('UPDATE support_assignments SET status=$2,resolved_at=CASE WHEN $2=$3 THEN NOW() ELSE NULL END,released_at=CASE WHEN $2<>$3 THEN NOW() ELSE NULL END,updated_at=NOW() WHERE conversation_id=$1 AND status=$4', [id, assignmentStatus, SupportAssignmentStatus.RESOLVED, SupportAssignmentStatus.ACTIVE]);
    await client.query('UPDATE assistant_conversation_participants SET left_at=NOW(),updated_at=NOW() WHERE conversation_id=$1 AND participant_role=$2 AND left_at IS NULL', [id, AssistantParticipantRole.SUPPORT_AGENT]);
    await client.query('UPDATE assistant_conversations SET mode=$2,status=$3,assigned_support_user_id=NULL,support_claimed_at=NULL,resolved_at=CASE WHEN $3=$4 THEN NOW() ELSE NULL END,version=version+1,updated_at=NOW() WHERE id=$1', [id, mode, status, AssistantConversationStatus.RESOLVED]);
    await this.audit(client, actor.sub, id, action); return { success: true };
  }); }
  private async assignedMutation<T>(actor: JwtPayload, id: string, fn: (client: PoolClient, row: { last_sequence: string }) => Promise<T>): Promise<T> { return this.database.transaction(async (client) => {
    await this.authority(client, actor); const result = await client.query<{ assigned_support_user_id: string | null; last_sequence: string }>('SELECT assigned_support_user_id,last_sequence FROM assistant_conversations WHERE id=$1 FOR UPDATE', [id]);
    if (!result.rows[0]) {throw new NotFoundException();} if (result.rows[0].assigned_support_user_id !== actor.sub) {throw new ForbiddenException('support.errors.readOnlyHistory');} return fn(client, result.rows[0]);
  }); }
  private async withVisible<T>(actor: JwtPayload, id: string, lock: boolean, fn: (client: PoolClient, row: SupportVisibleConversationRow) => Promise<T>): Promise<T> { return this.database.transaction(async (client) => {
    await this.authority(client, actor); const result = await client.query<SupportVisibleConversationRow>(`SELECT c.id,c.status,c.mode,c.assigned_support_user_id,c.last_sequence FROM assistant_conversations c LEFT JOIN assistant_conversation_participants p ON p.conversation_id=c.id AND p.user_id=$2 WHERE c.id=$1 AND (c.mode=$3 OR c.assigned_support_user_id=$2 OR p.id IS NOT NULL)${lock ? ' FOR UPDATE OF c' : ''}`, [id, actor.sub, AssistantConversationMode.WAITING_FOR_SUPPORT]);
    if (!result.rows[0]) {throw new NotFoundException();} return fn(client, result.rows[0]);
  }); }
  private async assertCapacity(client: PoolClient, userId: string) { const result = await client.query<{ capacity: number; active: number }>('SELECT COALESCE(sp.capacity,$2)::int capacity,(SELECT COUNT(*)::int FROM support_assignments WHERE support_user_id=$1 AND status=$3) active FROM users u LEFT JOIN support_profiles sp ON sp.user_id=u.id WHERE u.id=$1 FOR UPDATE OF u', [userId, DEFAULT_CAPACITY, SupportAssignmentStatus.ACTIVE]); if (!result.rows[0] || result.rows[0].active >= result.rows[0].capacity) {throw new ConflictException('support.errors.capacity');} }
  private async assertEligibleTarget(client: PoolClient, userId: string) { const role = await client.query<{ role: UserRole }>('SELECT role FROM users WHERE id=$1 FOR UPDATE', [userId]); if (role.rows[0]?.role !== UserRole.SUPPORT) {throw new ConflictException('support.errors.target');} await this.assertCapacity(client, userId); const state = await this.presence.get(userId); if (state.availability !== SupportAgentAvailability.AVAILABLE || state.connectionCount === 0) {throw new ConflictException('support.errors.targetUnavailable');} }
  private audit(client: PoolClient, actor: string, conversation: string | null, action: SupportAuditAction, target: string | null = null) { return client.query('INSERT INTO support_audit_log(conversation_id,actor_user_id,action,target_user_id) VALUES($1,$2,$3,$4)', [conversation, actor, this.auditValue(action), target]); }
  private auditValue(action: SupportAuditAction): string { const aliases: Partial<Record<SupportAuditAction,string>> = { [SupportAuditAction.QUEUE_PREVIEWED]:'queue_viewed', [SupportAuditAction.REOPENED_SUPPORT]:'reopened' }; return aliases[action] ?? action; }
}
