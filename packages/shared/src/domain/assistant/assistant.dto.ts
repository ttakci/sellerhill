import type { SupportedLocale } from '../common/common.constants';
import type { AssistantParticipantRole } from '../support/support.enums';

import type { AssistantConnectionStatus, AssistantContextSourceType, AssistantConversationMode, AssistantConversationStatus, AssistantErrorCode, AssistantGenerationStatus, AssistantGroundingConfidence, AssistantHandoffReason, AssistantLimitReason, AssistantLocalSendStatus, AssistantMessageAuthorType, AssistantMessageStatus, AssistantMessageType, AssistantUsageStatus, AssistantWidgetView } from './assistant.enums';

export interface AssistantCitationDto { id: string; ordinal: number; sourceTitle: string; sourceLocale: SupportedLocale; publicRouteKey: string; quotedText: string | null }
export interface AssistantContextSourceDto { type: AssistantContextSourceType; resourceId: string | null; label: string | null }
export interface AssistantMessageDto { id: string; conversationId: string; sequence: string; clientMessageId: string | null; authorType: AssistantMessageAuthorType; authorUserId: string | null; messageType: AssistantMessageType; status: AssistantMessageStatus; content: string; detectedLocale: SupportedLocale | null; replyToMessageId: string | null; generationId: string | null; citations: AssistantCitationDto[]; contextSources: AssistantContextSourceDto[]; createdAt: string; completedAt: string | null }
export interface AssistantConversationSummaryDto { id: string; title: string; mode: AssistantConversationMode; status: AssistantConversationStatus; locale: SupportedLocale; assignedSupportUserId: string | null; lastMessageAt: string; lastSequence: string; unreadCount: number; createdAt: string; updatedAt: string }
export interface AssistantConversationDto extends AssistantConversationSummaryDto { supportRequestedAt: string | null; supportClaimedAt: string | null; resolvedAt: string | null; archivedAt: string | null; deletedAt: string | null; deleteAfter: string | null; currentUserParticipantRole: AssistantParticipantRole; currentUserCanReply: boolean }
export interface AssistantConversationListDto { items: AssistantConversationSummaryDto[]; nextCursor: string | null; unreadTotal: number }
export interface AssistantMessageListDto { items: AssistantMessageDto[]; nextBeforeSequence: string | null }
export interface CreateAssistantConversationRequest { locale: SupportedLocale; clientConversationId: string }
export interface UpdateAssistantConversationRequest { title: string }
export interface MarkAssistantConversationReadRequest { throughSequence: string }
export interface RequestSupportRequest { reason: AssistantHandoffReason; sourceMessageId?: string }
export interface CreateAssistantMessageRequest { clientMessageId: string; content: string }
export interface StreamAssistantMessageRequest extends CreateAssistantMessageRequest {}
export interface RetryAssistantMessageRequest { clientAttemptId: string }
export interface AssistantGenerationAttemptDto { id: string; conversationId: string; userMessageId: string; assistantMessageId: string; attemptNumber: number; status: AssistantGenerationStatus; model: string | null; groundingConfidence: AssistantGroundingConfidence | null; promptTokens: number | null; completionTokens: number | null; totalTokens: number | null; usageStatus: AssistantUsageStatus | null; startedAt: string | null; firstTokenAt: string | null; completedAt: string | null; errorCode: AssistantErrorCode | null }
export interface AssistantLimitStateDto { reason: AssistantLimitReason | null; retryAfterSeconds: number | null; dailyTokensRemaining: number | null; dailyResetAt: string | null }
export interface AssistantErrorDto { code: AssistantErrorCode; retryable: boolean; messageKey: string; requestId: string }
export interface AssistantWidgetStateDto { view: AssistantWidgetView; connectionStatus: AssistantConnectionStatus; localSendStatus: AssistantLocalSendStatus; activeConversationId: string | null }
