import { Injectable } from '@nestjs/common';
import {
  AssistantConversationMode,
  AssistantConversationStatus,
  AssistantMessageAuthorType,
  AssistantMessageStatus,
  AssistantMessageType,
} from '@repo/shared';
import type { PoolClient } from 'pg';

import { DatabaseService } from '../../../common/database/database.service';

export interface AssistantConversationRow {
  id: string;
  userId: string;
  clientConversationId: string | null;
  title: string | null;
  mode: AssistantConversationMode;
  status: AssistantConversationStatus;
  locale: string;
  assignedSupportUserId: string | null;
  lastSequence: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssistantMessageRow {
  id: string;
  conversationId: string;
  sequence: string;
  clientMessageId: string | null;
  authorType: AssistantMessageAuthorType;
  authorUserId: string | null;
  messageType: AssistantMessageType;
  status: AssistantMessageStatus;
  content: string;
  createdAt: Date;
  completedAt: Date | null;
}

type ConversationDbRow = {
  id: string; user_id: string; client_conversation_id: string | null; title: string | null;
  mode: AssistantConversationMode; status: AssistantConversationStatus; locale: string;
  assigned_support_user_id: string | null; last_sequence: string; version: string;
  created_at: Date; updated_at: Date;
};
type MessageDbRow = {
  id: string; conversation_id: string; sequence: string; client_message_id: string | null;
  author_type: AssistantMessageAuthorType; author_user_id: string | null;
  message_type: AssistantMessageType; status: AssistantMessageStatus; content: string;
  created_at: Date; completed_at: Date | null;
};

const CONVERSATION_COLUMNS = `id,user_id,client_conversation_id,title,mode,status,locale,
 assigned_support_user_id,last_sequence,version,created_at,updated_at`;
const MESSAGE_COLUMNS = `id,conversation_id,sequence,client_message_id,author_type,
 author_user_id,message_type,status,content,created_at,completed_at`;

function mapConversation(row: ConversationDbRow): AssistantConversationRow {
  return { id: row.id, userId: row.user_id, clientConversationId: row.client_conversation_id,
    title: row.title, mode: row.mode, status: row.status, locale: row.locale,
    assignedSupportUserId: row.assigned_support_user_id, lastSequence: row.last_sequence,
    version: row.version, createdAt: row.created_at, updatedAt: row.updated_at };
}
function mapMessage(row: MessageDbRow): AssistantMessageRow {
  return { id: row.id, conversationId: row.conversation_id, sequence: row.sequence,
    clientMessageId: row.client_message_id, authorType: row.author_type,
    authorUserId: row.author_user_id, messageType: row.message_type, status: row.status,
    content: row.content, createdAt: row.created_at, completedAt: row.completed_at };
}

@Injectable()
export class AssistantConversationRepository {
  constructor(private readonly database: DatabaseService) {}

  async findForTenant(userId: string, conversationId: string, includeDeleted = false): Promise<AssistantConversationRow | null> {
    const deleted = includeDeleted ? '' : 'AND status <> $3';
    const params: (string | boolean)[] = [conversationId, userId];
    if (!includeDeleted) {
      params.push(AssistantConversationStatus.DELETED);
    }
    const rows = await this.database.query<ConversationDbRow>(
      `SELECT ${CONVERSATION_COLUMNS} FROM assistant_conversations WHERE id=$1 AND user_id=$2 ${deleted}`,
      params,
    );
    return rows[0] ? mapConversation(rows[0]) : null;
  }

  async listForTenant(userId: string, limit: number, before: Date | null): Promise<AssistantConversationRow[]> {
    const rows = await this.database.query<ConversationDbRow>(
      `SELECT ${CONVERSATION_COLUMNS} FROM assistant_conversations
       WHERE user_id=$1 AND status<>$2 AND ($3::timestamptz IS NULL OR updated_at<$3)
       ORDER BY updated_at DESC,id DESC LIMIT $4`,
      [userId, AssistantConversationStatus.DELETED, before?.toISOString() ?? null, Math.min(Math.max(limit, 1), 100)],
    );
    return rows.map(mapConversation);
  }

  async historyForTenant(userId: string, conversationId: string, after: string, limit: number): Promise<AssistantMessageRow[]> {
    const rows = await this.database.query<MessageDbRow>(
      `SELECT ${MESSAGE_COLUMNS} FROM assistant_messages m
       JOIN assistant_conversations c ON c.id=m.conversation_id
       WHERE m.conversation_id=$1 AND c.user_id=$2 AND m.sequence>$3::bigint AND m.deleted_at IS NULL
       ORDER BY m.sequence ASC LIMIT $4`,
      [conversationId, userId, after, Math.min(Math.max(limit, 1), 200)],
    );
    return rows.map(mapMessage);
  }

  async lockForTenant(client: PoolClient, userId: string, conversationId: string): Promise<AssistantConversationRow | null> {
    const result = await client.query<ConversationDbRow>(
      `SELECT ${CONVERSATION_COLUMNS} FROM assistant_conversations WHERE id=$1 AND user_id=$2 FOR UPDATE`,
      [conversationId, userId],
    );
    return result.rows[0] ? mapConversation(result.rows[0]) : null;
  }

  async nextSequence(client: PoolClient, userId: string, conversationId: string): Promise<string | null> {
    const result = await client.query<{ last_sequence: string }>(
      `UPDATE assistant_conversations SET last_sequence=last_sequence+1,version=version+1,updated_at=NOW()
       WHERE id=$1 AND user_id=$2 RETURNING last_sequence`, [conversationId, userId],
    );
    return result.rows[0]?.last_sequence ?? null;
  }

  async insertCustomerMessage(client: PoolClient, input: {
    userId: string; conversationId: string; clientMessageId: string; content: string;
    messageType: AssistantMessageType; status: AssistantMessageStatus;
  }): Promise<AssistantMessageRow | null> {
    const sequence = await this.nextSequence(client, input.userId, input.conversationId);
    if (!sequence) {
      return null;
    }
    const result = await client.query<MessageDbRow>(
      `INSERT INTO assistant_messages(conversation_id,sequence,client_message_id,author_type,author_user_id,message_type,status,content,completed_at)
       SELECT c.id,$3::bigint,$4,$5,$2,$6,$7,$8,CASE WHEN $7=$9 THEN NOW() ELSE NULL END
       FROM assistant_conversations c WHERE c.id=$1 AND c.user_id=$2
       ON CONFLICT(conversation_id,client_message_id) WHERE client_message_id IS NOT NULL DO UPDATE SET content=assistant_messages.content
       RETURNING ${MESSAGE_COLUMNS}`,
      [input.conversationId, input.userId, sequence, input.clientMessageId,
        AssistantMessageAuthorType.CUSTOMER, input.messageType, input.status, input.content,
        AssistantMessageStatus.COMPLETED],
    );
    return result.rows[0] ? mapMessage(result.rows[0]) : null;
  }

  async markRead(client: PoolClient, userId: string, conversationId: string, requestedSequence: string): Promise<string | null> {
    const result = await client.query<{ last_read_sequence: string }>(
      `UPDATE assistant_conversation_participants p SET
       last_read_sequence=GREATEST(p.last_read_sequence,LEAST($3::bigint,c.last_sequence)),last_read_at=NOW(),updated_at=NOW()
       FROM assistant_conversations c WHERE p.conversation_id=c.id AND c.id=$1 AND c.user_id=$2
       AND p.user_id=$2 AND p.left_at IS NULL RETURNING p.last_read_sequence`,
      [conversationId, userId, requestedSequence],
    );
    return result.rows[0]?.last_read_sequence ?? null;
  }
}
