// apps/api/src/modules/buyer-messaging/buyer-message-template.repository.ts
import { Injectable } from '@nestjs/common';
import { BuyerMessageEventType, type BuyerMessageTemplate } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';

interface TemplateRow {
  id: string; user_id: string; event_type: BuyerMessageEventType;
  name: string; body: string; locale: string; is_default: boolean;
  created_at: Date; updated_at: Date;
}

@Injectable()
export class BuyerMessageTemplateRepository {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Seeds a user's four starter templates (one per event, `is_default=true`)
   * from `buyer_message_system_defaults` on their very first read — never
   * re-seeds after that, even if the user later deletes a default, so a
   * removed starter template doesn't keep reappearing. Advisory-lock guarded
   * (same "lazy create on demand" idiom as resolveProductData in
   * listing-processor.service.ts) so two concurrent first reads can't double-insert.
   */
  async ensureSeeded(userId: string): Promise<void> {
    await this.db.transaction(async (client) => {
      await client.query(`SELECT pg_advisory_xact_lock(hashtext('buyer-msg-seed'), hashtext($1))`, [userId]);
      const { rows } = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM buyer_message_templates WHERE user_id=$1`,
        [userId],
      );
      if (Number(rows[0]?.count ?? '0') > 0) {
        return;
      }
      await client.query(
        `INSERT INTO buyer_message_templates (user_id, event_type, name, body, is_default)
         SELECT $1, d.event_type, INITCAP(REPLACE(d.event_type::text, '_', ' ')), d.body, TRUE
         FROM buyer_message_system_defaults d`,
        [userId],
      );
    });
  }

  async list(userId: string, eventType?: BuyerMessageEventType): Promise<BuyerMessageTemplate[]> {
    const rows = eventType
      ? await this.db.query<TemplateRow>(
          `SELECT * FROM buyer_message_templates WHERE user_id=$1 AND event_type=$2 ORDER BY created_at DESC`,
          [userId, eventType],
        )
      : await this.db.query<TemplateRow>(
          `SELECT * FROM buyer_message_templates WHERE user_id=$1 ORDER BY created_at DESC`,
          [userId],
        );
    return rows.map((r) => this.map(r));
  }

  async get(userId: string, id: string): Promise<BuyerMessageTemplate | null> {
    const rows = await this.db.query<TemplateRow>(
      `SELECT * FROM buyer_message_templates WHERE id=$1 AND user_id=$2`, [id, userId]);
    return rows[0] ? this.map(rows[0]) : null;
  }

  async create(userId: string, input: { eventType: BuyerMessageEventType; name: string; body: string; locale: string }): Promise<BuyerMessageTemplate> {
    const rows = await this.db.query<TemplateRow>(
      `INSERT INTO buyer_message_templates (user_id,event_type,name,body,locale)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [userId, input.eventType, input.name, input.body, input.locale]);
    return this.map(rows[0]);
  }

  async update(userId: string, id: string, input: { name?: string; body?: string; locale?: string }): Promise<BuyerMessageTemplate | null> {
    const rows = await this.db.query<TemplateRow>(
      `UPDATE buyer_message_templates SET name=COALESCE($3,name), body=COALESCE($4,body), locale=COALESCE($5,locale), updated_at=NOW()
       WHERE id=$1 AND user_id=$2 RETURNING *`,
      [id, userId, input.name ?? null, input.body ?? null, input.locale ?? null]);
    return rows[0] ? this.map(rows[0]) : null;
  }

  /** Restores a default-flagged template's body to the current system default for its event. Body only — a customized name is left as-is. */
  async resetToDefault(userId: string, id: string): Promise<BuyerMessageTemplate | null> {
    const rows = await this.db.query<TemplateRow>(
      `UPDATE buyer_message_templates t SET body = d.body, updated_at = NOW()
       FROM buyer_message_system_defaults d
       WHERE t.id=$1 AND t.user_id=$2 AND t.is_default = TRUE AND d.event_type = t.event_type
       RETURNING t.*`,
      [id, userId]);
    return rows[0] ? this.map(rows[0]) : null;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const rows = await this.db.query<{ id: string }>(
      `DELETE FROM buyer_message_templates WHERE id=$1 AND user_id=$2 RETURNING id`, [id, userId]);
    return rows.length > 0;
  }

  /** DB-stored default body for an event (replaces the old code-constant SYSTEM_BUYER_MESSAGE_TEMPLATES). */
  async getSystemDefaultBody(eventType: BuyerMessageEventType): Promise<string | null> {
    const rows = await this.db.query<{ body: string }>(
      `SELECT body FROM buyer_message_system_defaults WHERE event_type=$1`, [eventType]);
    return rows[0]?.body ?? null;
  }

  private map(r: TemplateRow): BuyerMessageTemplate {
    return {
      id: r.id, userId: r.user_id, eventType: r.event_type, name: r.name,
      body: r.body, locale: r.locale, isDefault: r.is_default,
      createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
    };
  }
}
