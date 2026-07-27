import {
  AssistantErrorCode,
  AssistantInboxEventType,
  AssistantStreamEventType,
  KnowledgeDocumentCategory,
  UserRole,
  assistantErrorSchema,
  assistantInboxEventEnvelopeSchema,
  assistantStreamEventEnvelopeSchema,
  createAssistantMessageSchema,
  knowledgeFrontmatterSchema,
  transferSupportConversationSchema,
  SupportTransferKind,
} from '@repo/shared';

describe('shared assistant contracts', () => {
  it('accepts every stream and inbox discriminator', () => {
    for (const eventType of Object.values(AssistantStreamEventType)) {
      expect(assistantStreamEventEnvelopeSchema.parse({ eventType }).eventType).toBe(eventType);
    }
    for (const eventType of Object.values(AssistantInboxEventType)) {
      expect(assistantInboxEventEnvelopeSchema.parse({ eventType }).eventType).toBe(eventType);
    }
  });

  it('accepts every error code and rejects unbounded messages', () => {
    for (const code of Object.values(AssistantErrorCode)) {
      expect(assistantErrorSchema.parse({ code, retryable: false, messageKey: `assistant.errors.${code}`, requestId: 'req-1' }).code).toBe(code);
    }
    expect(createAssistantMessageSchema.safeParse({ clientMessageId: '550e8400-e29b-41d4-a716-446655440000', content: 'x'.repeat(8001) }).success).toBe(false);
  });

  it('enforces transfer target and knowledge frontmatter bounds', () => {
    expect(transferSupportConversationSchema.safeParse({ kind: SupportTransferKind.AGENT }).success).toBe(false);
    for (const category of Object.values(KnowledgeDocumentCategory)) {
      expect(knowledgeFrontmatterSchema.parse({ slug: 'getting-started', locale: 'en', title: 'Title', summary: 'Summary', category, visibility: 'customer', version: 1, status: 'published' }).category).toBe(category);
    }
    expect(Object.values(UserRole)).toEqual(expect.arrayContaining([UserRole.CUSTOMER, UserRole.SUPPORT, UserRole.ADMIN]));
  });
});
