import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssistantConversationMode, AssistantConversationStatus, AssistantDurableEventType, AssistantGenerationStatus, AssistantMessageAuthorType, AssistantMessageStatus, AssistantMessageType, LlmUsagePurpose, type LlmMessage } from '@repo/shared';
import type { PoolClient } from 'pg';

import { DatabaseService } from '../../common/database/database.service';
import { LlmService } from '../llm/llm.service';

import { AssistantContextRouterService } from './assistant-context-router.service';
import { AssistantContextService, type AssistantReference } from './assistant-context.service';
import { AssistantOutputValidatorService } from './assistant-output-validator.service';
import { AssistantOutboxRepository } from './repositories/assistant-outbox.repository';
import { AssistantToolService } from './tools/assistant-tool.service';

const MAX_MESSAGE_LENGTH = 4_000;
const SNAPSHOT_INTERVAL_MS = 500;

export interface AssistantGenerationRequest { userId: string; conversationId: string; clientMessageId: string; content: string; signal?: AbortSignal; references?: AssistantReference[] }
export interface AssistantGenerationResult { userMessageId: string; assistantMessageId: string; attemptId: string; status: AssistantGenerationStatus; content: string }
interface ReservedGeneration extends AssistantGenerationResult { userId: string; conversationId: string; conversationVersion: string }

@Injectable()
export class AssistantGenerationService {
  constructor(private readonly database: DatabaseService, private readonly config: ConfigService, private readonly llm: LlmService, private readonly router: AssistantContextRouterService, private readonly context: AssistantContextService, private readonly tools: AssistantToolService, private readonly validator: AssistantOutputValidatorService, private readonly outbox: AssistantOutboxRepository) {}

  preflight(userId: string, conversationId: string): Promise<void> {
    return this.authorize(userId, conversationId);
  }

  async generate(request: AssistantGenerationRequest): Promise<AssistantGenerationResult> {
    const content = request.content.trim();
    if (!content || content.length > MAX_MESSAGE_LENGTH) {throw new ConflictException();}
    await this.authorize(request.userId, request.conversationId);
    if (request.signal?.aborted) {throw request.signal.reason ?? new Error('aborted');}
    const plan = this.router.plan(content);
    const toolResults = await Promise.all(plan.tools.map((tool) => this.tools.execute(request.userId, tool)));
    const references = request.references ?? [];
    const prompt = this.context.build({ applicationContext: 'Zonds account assistant', recentMessages: [], currentMessage: content, references, toolResults });
    if (request.signal?.aborted) {throw request.signal.reason ?? new Error('aborted');}
    const reserved = await this.database.transaction((client) => this.insertAttempt(client, request.userId, request.conversationId, request.clientMessageId, content, prompt));
    return this.stream(reserved, prompt, references, plan.retrievalRequired, request.signal);
  }

  async retry(userId: string, conversationId: string, userMessageId: string, signal?: AbortSignal): Promise<AssistantGenerationResult> {
    await this.authorize(userId, conversationId);
    const rows = await this.database.query<{ content: string }>(`SELECT m.content FROM assistant_messages m JOIN assistant_conversations c ON c.id=m.conversation_id WHERE m.id=$1 AND m.conversation_id=$2 AND c.user_id=$3 AND m.author_type=$4`, [userMessageId, conversationId, userId, AssistantMessageAuthorType.CUSTOMER]);
    if (!rows[0]) {throw new NotFoundException();}
    const prompt = this.context.build({ applicationContext: 'Zonds account assistant', recentMessages: [], currentMessage: rows[0].content, references: [], toolResults: [] });
    const reserved = await this.database.transaction((client) => this.insertAttempt(client, userId, conversationId, null, rows[0].content, prompt, userMessageId));
    return this.stream(reserved, prompt, [], false, signal);
  }

  private async authorize(userId: string, conversationId: string): Promise<void> {
    const rows = await this.database.query<{ id: string }>('SELECT id FROM assistant_conversations WHERE id=$1 AND user_id=$2 AND mode=$3 AND status=$4', [conversationId, userId, AssistantConversationMode.AI, AssistantConversationStatus.OPEN]);
    if (!rows[0]) {throw new NotFoundException();}
  }

  private async insertAttempt(client: PoolClient, userId: string, conversationId: string, clientMessageId: string | null, content: string, prompt: string, existingUserMessageId?: string): Promise<ReservedGeneration> {
    const conversation = await client.query<{ version: string }>('SELECT version FROM assistant_conversations WHERE id=$1 AND user_id=$2 AND mode=$3 AND status=$4 FOR UPDATE', [conversationId, userId, AssistantConversationMode.AI, AssistantConversationStatus.OPEN]);
    if (!conversation.rows[0]) {throw new NotFoundException();}
    let userMessageId = existingUserMessageId;
    if (!userMessageId) {
      const sequence = await this.nextSequence(client, conversationId, userId);
      const user = await client.query<{ id: string }>(`INSERT INTO assistant_messages(conversation_id,sequence,client_message_id,author_type,author_user_id,message_type,status,content,completed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW()) ON CONFLICT(conversation_id,client_message_id) WHERE client_message_id IS NOT NULL DO UPDATE SET content=assistant_messages.content RETURNING id`, [conversationId, sequence, clientMessageId, AssistantMessageAuthorType.CUSTOMER, userId, AssistantMessageType.TEXT, AssistantMessageStatus.COMPLETED, content]);
      userMessageId = user.rows[0].id;
    }
    const active = await client.query<{ id: string }>('SELECT id FROM assistant_generation_attempts WHERE user_message_id=$1 AND status IN($2,$3)', [userMessageId, AssistantGenerationStatus.RESERVED, AssistantGenerationStatus.RUNNING]);
    if (active.rows[0]) {throw new ConflictException();}
    const assistantSequence = await this.nextSequence(client, conversationId, userId);
    const assistant = await client.query<{ id: string }>(`INSERT INTO assistant_messages(conversation_id,sequence,author_type,message_type,status,content) VALUES($1,$2,$3,$4,$5,'') RETURNING id`, [conversationId, assistantSequence, AssistantMessageAuthorType.ASSISTANT, AssistantMessageType.TEXT, AssistantMessageStatus.PENDING]);
    const attempt = await client.query<{ id: string }>(`INSERT INTO assistant_generation_attempts(conversation_id,user_message_id,assistant_message_id,attempt_number,status,provider,model,context_token_estimate) SELECT $1,$2,$3,COALESCE(MAX(attempt_number),0)+1,$4,$5,$6,$7 FROM assistant_generation_attempts WHERE user_message_id=$2 RETURNING id`, [conversationId, userMessageId, assistant.rows[0].id, AssistantGenerationStatus.RESERVED, this.config.get<string>('LLM_PROVIDER', 'default'), this.config.get<string>('LLM_ASSISTANT_MODEL', ''), Math.ceil(prompt.length / 4)]);
    await client.query('UPDATE assistant_messages SET generation_id=$2 WHERE id=$1', [assistant.rows[0].id, attempt.rows[0].id]);
    await this.outbox.insertForTenant(client, { userId, eventType: AssistantDurableEventType.MESSAGE_CREATED, conversationId, sequence: assistantSequence, aggregateId: assistant.rows[0].id, aggregateVersion: conversation.rows[0].version });
    return { userId, conversationId, userMessageId, assistantMessageId: assistant.rows[0].id, attemptId: attempt.rows[0].id, status: AssistantGenerationStatus.RESERVED, content: '', conversationVersion: conversation.rows[0].version };
  }

  private async stream(reserved: ReservedGeneration, prompt: string, references: AssistantReference[], retrievalUsed: boolean, signal?: AbortSignal): Promise<AssistantGenerationResult> {
    let accumulated = ''; let lastFlush = 0;
    try {
      await this.database.query('UPDATE assistant_generation_attempts SET status=$2,started_at=NOW() WHERE id=$1', [reserved.attemptId, AssistantGenerationStatus.RUNNING]);
      const messages: LlmMessage[] = [{ role: 'user', content: prompt }];
      for await (const chunk of this.llm.chatStream(messages, { purpose: LlmUsagePurpose.ASSISTANT, userId: reserved.userId, generationAttemptId: reserved.attemptId, conversationId: reserved.conversationId, messageId: reserved.assistantMessageId, signal, maxTokens: 1_000 })) {
        accumulated = chunk.delta;
        if (Date.now() - lastFlush >= SNAPSHOT_INTERVAL_MS) {await this.snapshot(reserved.assistantMessageId, accumulated); lastFlush = Date.now();}
      }
      const validated = this.validator.validate(accumulated, references, retrievalUsed);
      if (!validated.safe) {throw new Error('unsafe_output');}
      await this.finish(reserved, validated.content, AssistantGenerationStatus.COMPLETED, AssistantMessageStatus.COMPLETED, AssistantDurableEventType.MESSAGE_COMPLETED);
      return { ...reserved, status: AssistantGenerationStatus.COMPLETED, content: validated.content };
    } catch (error) {
      const status = signal?.aborted ? AssistantGenerationStatus.CANCELLED : AssistantGenerationStatus.INCOMPLETE;
      await this.finish(reserved, accumulated, status, AssistantMessageStatus.INCOMPLETE, AssistantDurableEventType.MESSAGE_INCOMPLETE, error);
      return { ...reserved, status, content: accumulated };
    }
  }

  private snapshot(messageId: string, content: string): Promise<unknown> { return this.database.query('UPDATE assistant_messages SET content=$2,status=$3 WHERE id=$1 AND status IN($4,$5)', [messageId, content, AssistantMessageStatus.STREAMING, AssistantMessageStatus.PENDING, AssistantMessageStatus.STREAMING]); }
  private async finish(reserved: ReservedGeneration, content: string, generationStatus: AssistantGenerationStatus, messageStatus: AssistantMessageStatus, eventType: AssistantDurableEventType, error?: unknown): Promise<void> {
    await this.database.transaction(async (client) => {
      await client.query('UPDATE assistant_messages SET content=$2,status=$3,completed_at=CASE WHEN $3=$4 THEN NOW() ELSE completed_at END WHERE id=$1', [reserved.assistantMessageId, content, messageStatus, AssistantMessageStatus.COMPLETED]);
      await client.query('UPDATE assistant_generation_attempts SET status=$2,completed_at=NOW(),error_detail_redacted=$3 WHERE id=$1', [reserved.attemptId, generationStatus, error instanceof Error ? error.name : null]);
      await this.outbox.insertForTenant(client, { userId: reserved.userId, eventType, conversationId: reserved.conversationId, sequence: null, aggregateId: reserved.assistantMessageId, aggregateVersion: reserved.conversationVersion });
    });
  }
  private async nextSequence(client: PoolClient, conversationId: string, userId: string): Promise<string> { const result = await client.query<{ last_sequence: string }>('UPDATE assistant_conversations SET last_sequence=last_sequence+1,version=version+1,updated_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING last_sequence', [conversationId, userId]); if (!result.rows[0]) {throw new NotFoundException();} return result.rows[0].last_sequence; }
}
