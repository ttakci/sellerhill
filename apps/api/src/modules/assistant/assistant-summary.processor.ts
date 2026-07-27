import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmUsagePurpose, type LlmMessage } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { LlmService } from '../llm/llm.service';

@Injectable()
export class AssistantSummaryProcessor {
  constructor(private readonly database: DatabaseService, private readonly config: ConfigService, private readonly llm: LlmService) {}

  async process(conversationId: string, userId: string): Promise<void> {
    const messages = await this.database.query<{ sequence: string; content: string }>(`SELECT m.sequence,m.content FROM assistant_messages m JOIN assistant_conversations c ON c.id=m.conversation_id WHERE m.conversation_id=$1 AND c.user_id=$2 AND m.deleted_at IS NULL ORDER BY m.sequence DESC LIMIT 30`, [conversationId, userId]);
    if (messages.length < this.threshold()) {return;}
    const prompt: LlmMessage[] = [{ role: 'user', content: `Summarize this conversation faithfully without secrets:\n${messages.reverse().map((row) => row.content.slice(0, 1_000)).join('\n')}` }];
    const result = await this.llm.chat(prompt, { purpose: LlmUsagePurpose.ASSISTANT_SUMMARY, userId, maxTokens: 500 });
    await this.database.transaction(async (client) => {
      const summary = await client.query<{ id: string; revision: number }>(`INSERT INTO assistant_conversation_summaries(conversation_id,through_sequence,content) VALUES($1,$2,$3) ON CONFLICT(conversation_id) DO UPDATE SET through_sequence=EXCLUDED.through_sequence,content=EXCLUDED.content,revision=assistant_conversation_summaries.revision+1,updated_at=NOW() RETURNING id,revision`, [conversationId, messages[messages.length - 1].sequence, result.text.slice(0, 8_000)]);
      await client.query(`INSERT INTO assistant_summary_revisions(summary_id,revision,through_sequence,content) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [summary.rows[0].id, summary.rows[0].revision, messages[messages.length - 1].sequence, result.text.slice(0, 8_000)]);
    });
  }

  private threshold(): number { const value = Number(this.config.get<string>('ASSISTANT_SUMMARY_MESSAGE_THRESHOLD', '20')); return Number.isFinite(value) ? Math.max(10, Math.trunc(value)) : 20; }
}
