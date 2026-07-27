import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AssistantConversationMode,
  AssistantConversationStatus,
  AssistantDurableEventType,
  AssistantMessageStatus,
  AssistantMessageType,
  AssistantParticipantRole,
  SupportAssignmentStatus,
  type CreateAssistantConversationRequest,
} from '@repo/shared';
import type { PoolClient } from 'pg';

import { DatabaseService } from '../../common/database/database.service';

import { AssistantRetentionService } from './assistant-retention.service';
import { AssistantTransition, transitionAssistantState } from './assistant-state-machine';
import { AssistantConversationRepository, type AssistantConversationRow, type AssistantMessageRow } from './repositories/assistant-conversation.repository';
import { AssistantOutboxRepository } from './repositories/assistant-outbox.repository';

const TITLE_MAX_LENGTH = 160;
const MESSAGE_TITLE_MAX_LENGTH = 80;

@Injectable()
export class AssistantConversationService {
  constructor(
    private readonly database: DatabaseService,
    private readonly conversations: AssistantConversationRepository,
    private readonly outbox: AssistantOutboxRepository,
    private readonly retention: AssistantRetentionService,
  ) {}

  list(userId: string, limit = 20, before: Date | null = null): Promise<AssistantConversationRow[]> {
    return this.conversations.listForTenant(userId, limit, before);
  }

  async history(userId: string, conversationId: string, beforeSequence: string | undefined, limit = 50): Promise<AssistantMessageRow[]> {
    await this.detail(userId, conversationId);
    const rows = await this.conversations.historyForTenant(userId, conversationId, '0', Math.min(limit, 100));
    if (!beforeSequence) {
      return rows;
    }

    return rows.filter((row) => BigInt(row.sequence) < BigInt(beforeSequence));
  }

  async detail(userId: string, conversationId: string): Promise<AssistantConversationRow> {
    const row = await this.conversations.findForTenant(userId, conversationId);
    if (!row) {throw new NotFoundException();}
    return row;
  }

  async create(userId: string, request: CreateAssistantConversationRequest): Promise<AssistantConversationRow> {
    return this.database.transaction(async (client) => {
      const result = await client.query<{ id: string }>(
        `INSERT INTO assistant_conversations(user_id,client_conversation_id,locale)
         VALUES($1,$2,$3) ON CONFLICT(user_id,client_conversation_id) WHERE client_conversation_id IS NOT NULL
         DO UPDATE SET client_conversation_id=assistant_conversations.client_conversation_id RETURNING id`,
        [userId, request.clientConversationId, request.locale],
      );
      await client.query(
        `INSERT INTO assistant_conversation_participants(conversation_id,user_id,participant_role)
         VALUES($1,$2,$3) ON CONFLICT(conversation_id,user_id) WHERE left_at IS NULL DO NOTHING`,
        [result.rows[0].id, userId, AssistantParticipantRole.CUSTOMER],
      );
      const row = await this.conversations.lockForTenant(client, userId, result.rows[0].id);
      if (!row) {throw new NotFoundException();}
      await this.emit(client, row, AssistantDurableEventType.CONVERSATION_CREATED);
      return row;
    });
  }

  async rename(userId: string, conversationId: string, title: string): Promise<void> {
    const normalized = title.trim().slice(0, TITLE_MAX_LENGTH);
    if (!normalized) {throw new BadRequestException();}
    const rows = await this.database.query<{ id: string }>(
      `UPDATE assistant_conversations SET title=$3,version=version+1,updated_at=NOW()
       WHERE id=$1 AND user_id=$2 AND status<>$4 RETURNING id`,
      [conversationId, userId, normalized, AssistantConversationStatus.DELETED],
    );
    if (!rows[0]) {throw new NotFoundException();}
  }

  async markRead(userId: string, conversationId: string, throughSequence: string): Promise<string> {
    if (!/^\d+$/.test(throughSequence)) {throw new BadRequestException();}
    return this.database.transaction(async (client) => {
      const sequence = await this.conversations.markRead(client, userId, conversationId, throughSequence);
      if (sequence === null) {throw new NotFoundException();}
      const row = await this.conversations.lockForTenant(client, userId, conversationId);
      if (row) {await this.emit(client, row, AssistantDurableEventType.READ_UPDATED, sequence);}
      return sequence;
    });
  }

  async postSupportMessage(userId: string, conversationId: string, clientMessageId: string, content: string): Promise<AssistantMessageRow> {
    const normalized = content.trim();
    if (!normalized) {throw new BadRequestException();}
    return this.database.transaction(async (client) => {
      const row = await this.conversations.lockForTenant(client, userId, conversationId);
      if (!row) {throw new NotFoundException();}
      const supportMode = row.status === AssistantConversationStatus.OPEN &&
        (row.mode === AssistantConversationMode.WAITING_FOR_SUPPORT || row.mode === AssistantConversationMode.HUMAN);
      if (!supportMode) {throw new ConflictException();}
      const message = await this.conversations.insertCustomerMessage(client, {
        userId, conversationId, clientMessageId, content: normalized,
        messageType: AssistantMessageType.TEXT, status: AssistantMessageStatus.COMPLETED,
      });
      if (!message) {throw new NotFoundException();}
      await client.query(
        `UPDATE assistant_conversations SET title=COALESCE(title,$3),last_message_at=NOW() WHERE id=$1 AND user_id=$2`,
        [conversationId, userId, this.deriveTitle(normalized)],
      );
      await this.outbox.insertForTenant(client, { userId, eventType: AssistantDurableEventType.MESSAGE_CREATED,
        conversationId, sequence: message.sequence, aggregateId: message.id, aggregateVersion: row.version });
      return message;
    });
  }

  requestSupport(userId: string, id: string): Promise<AssistantConversationRow> { return this.lifecycle(userId, id, AssistantTransition.REQUEST_SUPPORT); }
  cancelSupport(userId: string, id: string): Promise<AssistantConversationRow> { return this.lifecycle(userId, id, AssistantTransition.CANCEL_SUPPORT); }
  resolve(userId: string, id: string): Promise<AssistantConversationRow> { return this.lifecycle(userId, id, AssistantTransition.RESOLVE); }
  reopenAi(userId: string, id: string): Promise<AssistantConversationRow> { return this.lifecycle(userId, id, AssistantTransition.REOPEN_AI); }
  reopenSupport(userId: string, id: string): Promise<AssistantConversationRow> { return this.lifecycle(userId, id, AssistantTransition.REOPEN_SUPPORT); }
  archive(userId: string, id: string): Promise<AssistantConversationRow> { return this.lifecycle(userId, id, AssistantTransition.ARCHIVE); }

  async unarchive(userId: string, id: string, restoreStatus: AssistantConversationStatus): Promise<AssistantConversationRow> {
    const transition = restoreStatus === AssistantConversationStatus.RESOLVED ? AssistantTransition.UNARCHIVE_RESOLVED : AssistantTransition.UNARCHIVE_OPEN;
    return this.lifecycle(userId, id, transition);
  }

  async delete(userId: string, id: string): Promise<AssistantConversationRow> {
    return this.lifecycle(userId, id, AssistantTransition.DELETE, this.retention.deleteAfter());
  }

  async restore(userId: string, id: string): Promise<AssistantConversationRow> {
    return this.database.transaction(async (client) => {
      const row = await this.conversations.lockForTenant(client, userId, id);
      if (!row) {throw new NotFoundException();}
      const snapshots = await client.query<{ restore_status: AssistantConversationStatus; delete_after: Date }>(
        'SELECT restore_status,delete_after FROM assistant_conversations WHERE id=$1 AND user_id=$2', [id, userId]);
      const snapshot = snapshots.rows[0];
      if (!snapshot || !this.retention.isRestoreEligible({ deleteAfter: snapshot.delete_after, lastMessageAt: row.updatedAt })) {throw new ConflictException();}
      const transition = snapshot.restore_status === AssistantConversationStatus.ARCHIVED ? AssistantTransition.RESTORE_ARCHIVED
        : snapshot.restore_status === AssistantConversationStatus.RESOLVED ? AssistantTransition.RESTORE_RESOLVED : AssistantTransition.RESTORE_OPEN;
      return this.applyLifecycle(client, row, transition, null);
    });
  }

  private async lifecycle(userId: string, id: string, transition: AssistantTransition, deleteAfter: Date | null = null): Promise<AssistantConversationRow> {
    return this.database.transaction(async (client) => {
      const row = await this.conversations.lockForTenant(client, userId, id);
      if (!row) {throw new NotFoundException();}
      return this.applyLifecycle(client, row, transition, deleteAfter);
    });
  }

  private async applyLifecycle(client: PoolClient, row: AssistantConversationRow, transition: AssistantTransition, deleteAfter: Date | null): Promise<AssistantConversationRow> {
    const next = transitionAssistantState(row, transition);
    if (!next) {throw new ConflictException();}
    const deleting = transition === AssistantTransition.DELETE;
    const supportRequested = next.mode === AssistantConversationMode.WAITING_FOR_SUPPORT;
    const result = await client.query<{ id: string }>(
      `UPDATE assistant_conversations SET mode=$3,status=$4,assigned_support_user_id=NULL,
       support_requested_at=CASE WHEN $5 THEN NOW() ELSE NULL END,support_claimed_at=NULL,
       resolved_at=CASE WHEN $4=$6 THEN NOW() ELSE NULL END,archived_at=CASE WHEN $4=$7 THEN NOW() ELSE NULL END,
       restore_status=CASE WHEN $8 THEN $2 ELSE NULL END,deleted_at=CASE WHEN $8 THEN NOW() ELSE NULL END,
       delete_after=$9,version=version+1,updated_at=NOW() WHERE id=$1 RETURNING id`,
      [row.id, row.status, next.mode, next.status, supportRequested, AssistantConversationStatus.RESOLVED,
        AssistantConversationStatus.ARCHIVED, deleting, deleteAfter?.toISOString() ?? null],
    );
    if (!result.rows[0]) {throw new ConflictException();}
    if (row.mode === AssistantConversationMode.HUMAN) {
      await client.query(`UPDATE support_assignments SET status=$2,resolved_at=NOW(),updated_at=NOW() WHERE conversation_id=$1 AND status=$3`, [row.id, SupportAssignmentStatus.RESOLVED, SupportAssignmentStatus.ACTIVE]);
      await client.query('UPDATE assistant_conversation_participants SET left_at=NOW(),updated_at=NOW() WHERE conversation_id=$1 AND participant_role=$2 AND left_at IS NULL', [row.id, AssistantParticipantRole.SUPPORT_AGENT]);
    }
    const updated = await this.conversations.lockForTenant(client, row.userId, row.id);
    if (!updated) {throw new NotFoundException();}
    const event = deleting ? AssistantDurableEventType.CONVERSATION_DELETED : transition.toString().startsWith('restore') ? AssistantDurableEventType.CONVERSATION_RESTORED : AssistantDurableEventType.CONVERSATION_UPDATED;
    await this.emit(client, updated, event);
    if (supportRequested) {await this.outbox.insertSupportQueue(client, { eventType: AssistantDurableEventType.SUPPORT_QUEUE_UPDATED, conversationId: row.id, aggregateId: row.id, aggregateVersion: updated.version });}
    return updated;
  }

  private emit(client: PoolClient, row: AssistantConversationRow, eventType: AssistantDurableEventType, sequence: string | null = null): Promise<unknown> {
    return this.outbox.insertForTenant(client, { userId: row.userId, eventType, conversationId: row.id, sequence, aggregateId: row.id, aggregateVersion: row.version });
  }

  private deriveTitle(content: string): string {
    const firstLine = content.split(/\r?\n/, 1)[0].replace(/\s+/g, ' ').trim();
    return firstLine.slice(0, MESSAGE_TITLE_MAX_LENGTH);
  }
}
