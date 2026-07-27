// apps/api/src/modules/buyer-messaging/buyer-message-template.repository.ts
import { Injectable } from '@nestjs/common';
import { BuyerMessageEventType, type BuyerMessageTemplate } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';

interface TemplateRow {
  id: string; user_id: string; event_type: BuyerMessageEventType;
  name: string; body: string; locale: string;
  created_at: Date; updated_at: Date;
}

@Injectable()
export class BuyerMessageTemplateRepository {
  constructor(private readonly db: DatabaseService) {}

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

  async delete(userId: string, id: string): Promise<boolean> {
    const rows = await this.db.query<{ id: string }>(
      `DELETE FROM buyer_message_templates WHERE id=$1 AND user_id=$2 RETURNING id`, [id, userId]);
    return rows.length > 0;
  }

  private map(r: TemplateRow): BuyerMessageTemplate {
    return {
      id: r.id, userId: r.user_id, eventType: r.event_type, name: r.name,
      body: r.body, locale: r.locale,
      createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
    };
  }
}
