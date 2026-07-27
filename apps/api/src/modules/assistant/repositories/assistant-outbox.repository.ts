import { Injectable } from '@nestjs/common';
import {
  AssistantDurableEventType,
  AssistantEventRecipientKind,
  AssistantEventTopic,
} from '@repo/shared';
import type { PoolClient } from 'pg';

import { DatabaseService } from '../../../common/database/database.service';

export interface AssistantOutboxRow {
  id: string;
  eventId: string;
  eventType: AssistantDurableEventType;
  recipientKind: AssistantEventRecipientKind;
  recipientUserId: string | null;
  recipientTopic: AssistantEventTopic | null;
  conversationId: string | null;
  sequence: string | null;
  aggregateId: string;
  aggregateVersion: string;
  createdAt: Date;
}
type DbRow = {
  id: string; event_id: string; event_type: AssistantDurableEventType;
  recipient_kind: AssistantEventRecipientKind; recipient_user_id: string | null;
  recipient_topic: AssistantEventTopic | null; conversation_id: string | null;
  sequence: string | null; aggregate_id: string; aggregate_version: string; created_at: Date;
};
const COLUMNS = `id,event_id,event_type,recipient_kind,recipient_user_id,recipient_topic,
 conversation_id,sequence,aggregate_id,aggregate_version,created_at`;
function mapRow(row: DbRow): AssistantOutboxRow {
  return { id: row.id, eventId: row.event_id, eventType: row.event_type,
    recipientKind: row.recipient_kind, recipientUserId: row.recipient_user_id,
    recipientTopic: row.recipient_topic, conversationId: row.conversation_id,
    sequence: row.sequence, aggregateId: row.aggregate_id,
    aggregateVersion: row.aggregate_version, createdAt: row.created_at };
}

@Injectable()
export class AssistantOutboxRepository {
  constructor(private readonly database: DatabaseService) {}

  async insertForTenant(client: PoolClient, input: {
    userId: string; eventType: AssistantDurableEventType; conversationId: string;
    sequence: string | null; aggregateId: string; aggregateVersion: string;
  }): Promise<AssistantOutboxRow | null> {
    const result = await client.query<DbRow>(
      `INSERT INTO assistant_event_outbox(event_type,recipient_kind,recipient_user_id,conversation_id,sequence,aggregate_id,aggregate_version)
       SELECT $3,$4,$1,c.id,$5::bigint,$6,$7::bigint FROM assistant_conversations c
       WHERE c.id=$2 AND c.user_id=$1 RETURNING ${COLUMNS}`,
      [input.userId, input.conversationId, input.eventType, AssistantEventRecipientKind.USER,
        input.sequence, input.aggregateId, input.aggregateVersion],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async highWatermark(): Promise<string> {
    const rows = await this.database.query<{ id: string }>('SELECT COALESCE(MAX(id),0)::text id FROM assistant_event_outbox');
    return rows[0].id;
  }

  async findById(id: string): Promise<AssistantOutboxRow | null> {
    const rows = await this.database.query<DbRow>(`SELECT ${COLUMNS} FROM assistant_event_outbox WHERE id=$1`, [id]);
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async replay(userId: string, includeSupportQueue: boolean, afterId: string, throughId: string): Promise<AssistantOutboxRow[]> {
    const rows = await this.database.query<DbRow>(
      `SELECT ${COLUMNS} FROM assistant_event_outbox WHERE id>$1::bigint AND id<=$2::bigint
       AND dead_lettered_at IS NULL AND expires_at>NOW() AND
       ((recipient_kind=$3 AND recipient_user_id=$4) OR ($5 AND recipient_kind=$6 AND recipient_topic=$7))
       ORDER BY id ASC LIMIT 1000`,
      [afterId, throughId, AssistantEventRecipientKind.USER, userId, includeSupportQueue,
        AssistantEventRecipientKind.TOPIC, AssistantEventTopic.SUPPORT_QUEUE],
    );
    return rows.map(mapRow);
  }

  async lease(ownerId: string, limit: number, leaseSeconds: number): Promise<AssistantOutboxRow[]> {
    return this.database.transaction(async (client) => {
      const result = await client.query<DbRow>(
        `WITH candidates AS (SELECT id FROM assistant_event_outbox WHERE dispatched_at IS NULL
          AND dead_lettered_at IS NULL AND available_at<=NOW() AND (leased_until IS NULL OR leased_until<NOW())
          ORDER BY id FOR UPDATE SKIP LOCKED LIMIT $2)
         UPDATE assistant_event_outbox o SET lease_owner=$1,leased_until=NOW()+($3*INTERVAL '1 second'),attempt_count=attempt_count+1
         FROM candidates c WHERE o.id=c.id RETURNING o.id,o.event_id,o.event_type,o.recipient_kind,o.recipient_user_id,o.recipient_topic,
          o.conversation_id,o.sequence,o.aggregate_id,o.aggregate_version,o.created_at`,
        [ownerId, Math.min(Math.max(limit, 1), 500), leaseSeconds],
      );
      return result.rows.map(mapRow);
    });
  }

  async markDispatched(ownerId: string, id: string): Promise<boolean> {
    const rows = await this.database.query<{ id: string }>(
      `UPDATE assistant_event_outbox SET dispatched_at=NOW(),lease_owner=NULL,leased_until=NULL
       WHERE id=$1 AND lease_owner=$2 AND dispatched_at IS NULL RETURNING id`, [id, ownerId]);
    return Boolean(rows[0]);
  }

  async reschedule(ownerId: string, id: string, errorCode: string, maxAttempts: number): Promise<void> {
    await this.database.query(
      `UPDATE assistant_event_outbox SET lease_owner=NULL,leased_until=NULL,last_error_code=$3,
       dead_lettered_at=CASE WHEN attempt_count >= $4 THEN NOW() ELSE NULL END,
       available_at=CASE WHEN attempt_count >= $4 THEN available_at ELSE NOW()+(LEAST(300,POWER(2,attempt_count)) * INTERVAL '1 second') END
       WHERE id=$1 AND lease_owner=$2`, [id, ownerId, errorCode, maxAttempts]);
  }

  async insertSupportQueue(client: PoolClient, input: {
    eventType: AssistantDurableEventType; conversationId: string; aggregateId: string; aggregateVersion: string;
  }): Promise<AssistantOutboxRow> {
    const result = await client.query<DbRow>(
      `INSERT INTO assistant_event_outbox(event_type,recipient_kind,recipient_topic,conversation_id,aggregate_id,aggregate_version)
       VALUES($1,$2,$3,$4,$5,$6::bigint) RETURNING ${COLUMNS}`,
      [input.eventType, AssistantEventRecipientKind.TOPIC, AssistantEventTopic.SUPPORT_QUEUE,
        input.conversationId, input.aggregateId, input.aggregateVersion],
    );
    return mapRow(result.rows[0]);
  }
}
