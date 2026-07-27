import { Injectable } from '@nestjs/common';
import { AssistantConversationMode, AssistantConversationStatus, SupportAssignmentStatus } from '@repo/shared';
import type { PoolClient } from 'pg';

import { DatabaseService } from '../../../common/database/database.service';

export interface SupportQueueRow {
  conversationId: string;
  customerUserId: string;
  title: string | null;
  mode: AssistantConversationMode;
  status: AssistantConversationStatus;
  assignedSupportUserId: string | null;
  supportRequestedAt: Date | null;
  lastMessageAt: Date;
  lastSequence: string;
  version: string;
}
type DbRow = {
  id: string; user_id: string; title: string | null; mode: AssistantConversationMode;
  status: AssistantConversationStatus; assigned_support_user_id: string | null;
  support_requested_at: Date | null; last_message_at: Date; last_sequence: string; version: string;
};
const COLUMNS = `id,user_id,title,mode,status,assigned_support_user_id,support_requested_at,
 last_message_at,last_sequence,version`;
const SUPPORT_COLUMNS = `c.id,c.user_id,c.title,c.mode,c.status,c.assigned_support_user_id,
 c.support_requested_at,c.last_message_at,c.last_sequence,c.version`;
function mapRow(row: DbRow): SupportQueueRow {
  return { conversationId: row.id, customerUserId: row.user_id, title: row.title,
    mode: row.mode, status: row.status, assignedSupportUserId: row.assigned_support_user_id,
    supportRequestedAt: row.support_requested_at, lastMessageAt: row.last_message_at,
    lastSequence: row.last_sequence, version: row.version };
}

@Injectable()
export class SupportConversationRepository {
  constructor(private readonly database: DatabaseService) {}

  async listWaitingQueue(limit: number): Promise<SupportQueueRow[]> {
    const rows = await this.database.query<DbRow>(
      `SELECT ${COLUMNS} FROM assistant_conversations WHERE status=$1 AND mode=$2
       ORDER BY support_requested_at ASC,last_message_at ASC,id ASC LIMIT $3`,
      [AssistantConversationStatus.OPEN, AssistantConversationMode.WAITING_FOR_SUPPORT,
        Math.min(Math.max(limit, 1), 100)],
    );
    return rows.map(mapRow);
  }

  async findVisibleToSupport(supportUserId: string, conversationId: string): Promise<SupportQueueRow | null> {
    const rows = await this.database.query<DbRow>(
      `SELECT DISTINCT ${SUPPORT_COLUMNS}
       FROM assistant_conversations c LEFT JOIN assistant_conversation_participants p
       ON p.conversation_id=c.id AND p.user_id=$1
       WHERE c.id=$2 AND (c.mode=$3 OR c.assigned_support_user_id=$1 OR p.id IS NOT NULL)`,
      [supportUserId, conversationId, AssistantConversationMode.WAITING_FOR_SUPPORT],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async claim(client: PoolClient, supportUserId: string, conversationId: string): Promise<SupportQueueRow | null> {
    const updated = await client.query<DbRow>(
      `UPDATE assistant_conversations SET mode=$3,assigned_support_user_id=$2,support_claimed_at=NOW(),
       version=version+1,updated_at=NOW() WHERE id=$1 AND status=$4 AND mode=$5 AND assigned_support_user_id IS NULL
       RETURNING ${COLUMNS}`,
      [conversationId, supportUserId, AssistantConversationMode.HUMAN, AssistantConversationStatus.OPEN,
        AssistantConversationMode.WAITING_FOR_SUPPORT],
    );
    if (!updated.rows[0]) {
      return null;
    }
    await client.query(
      `INSERT INTO support_assignments(conversation_id,support_user_id,status) VALUES($1,$2,$3)`,
      [conversationId, supportUserId, SupportAssignmentStatus.ACTIVE],
    );
    await client.query(
      `INSERT INTO assistant_conversation_participants(conversation_id,user_id,participant_role)
       VALUES($1,$2,'support_agent') ON CONFLICT(conversation_id,user_id) WHERE left_at IS NULL DO NOTHING`,
      [conversationId, supportUserId],
    );
    return mapRow(updated.rows[0]);
  }

  async release(client: PoolClient, supportUserId: string, conversationId: string, reason: string): Promise<boolean> {
    const assignment = await client.query<{ id: string }>(
      `UPDATE support_assignments a SET status=$3,released_at=NOW(),release_reason=$4,updated_at=NOW()
       FROM assistant_conversations c WHERE a.conversation_id=c.id AND c.id=$1 AND a.support_user_id=$2
       AND a.status=$5 AND c.assigned_support_user_id=$2 RETURNING a.id`,
      [conversationId, supportUserId, SupportAssignmentStatus.RELEASED, reason, SupportAssignmentStatus.ACTIVE],
    );
    if (!assignment.rows[0]) {
      return false;
    }
    await client.query(
      `UPDATE assistant_conversations SET mode=$2,assigned_support_user_id=NULL,support_claimed_at=NULL,
       version=version+1,updated_at=NOW() WHERE id=$1 AND assigned_support_user_id=$3`,
      [conversationId, AssistantConversationMode.WAITING_FOR_SUPPORT, supportUserId],
    );
    await client.query(
      `UPDATE assistant_conversation_participants SET left_at=NOW(),updated_at=NOW()
       WHERE conversation_id=$1 AND user_id=$2 AND left_at IS NULL`, [conversationId, supportUserId],
    );
    return true;
  }
}
