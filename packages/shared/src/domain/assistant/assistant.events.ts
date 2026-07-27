import type { AssistantCitationDto, AssistantErrorDto, AssistantLimitStateDto, AssistantMessageDto } from './assistant.dto';
import type { AssistantDurableEventType, AssistantEphemeralEventType, AssistantEventRecipientKind, AssistantEventTopic, AssistantHandoffReason, AssistantInboxEventType, AssistantResyncReason, AssistantStreamEventType } from './assistant.enums';

export interface StreamStartedEvent { eventType: AssistantStreamEventType.STREAM_STARTED; conversationId: string; requestId: string; serverTime: string }
export interface UserMessageAcceptedEvent { eventType: AssistantStreamEventType.USER_MESSAGE_ACCEPTED; message: AssistantMessageDto }
export interface AssistantMessageStartedEvent { eventType: AssistantStreamEventType.ASSISTANT_MESSAGE_STARTED; messageId: string; sequence: string; generationId: string }
export interface AssistantMessageSnapshotEvent { eventType: AssistantStreamEventType.ASSISTANT_MESSAGE_SNAPSHOT; messageId: string; revision: number; content: string }
export interface CitationsReadyEvent { eventType: AssistantStreamEventType.CITATIONS_READY; messageId: string; citations: AssistantCitationDto[] }
export interface AssistantMessageCompletedEvent { eventType: AssistantStreamEventType.ASSISTANT_MESSAGE_COMPLETED; message: AssistantMessageDto; usage: AssistantLimitStateDto }
export interface AssistantMessageIncompleteEvent { eventType: AssistantStreamEventType.ASSISTANT_MESSAGE_INCOMPLETE; message: AssistantMessageDto; retryable: boolean }
export interface AssistantRateLimitedEvent { eventType: AssistantStreamEventType.RATE_LIMITED; limit: AssistantLimitStateDto }
export interface AssistantHandoffOfferedEvent { eventType: AssistantStreamEventType.HANDOFF_OFFERED; reason: AssistantHandoffReason; sourceMessageId: string | null }
export interface AssistantStreamErrorEvent extends AssistantErrorDto { eventType: AssistantStreamEventType.ERROR }
export interface StreamCompletedEvent { eventType: AssistantStreamEventType.STREAM_COMPLETED; terminalObserved: boolean }
export type AssistantStreamEvent = StreamStartedEvent | UserMessageAcceptedEvent | AssistantMessageStartedEvent | AssistantMessageSnapshotEvent | CitationsReadyEvent | AssistantMessageCompletedEvent | AssistantMessageIncompleteEvent | AssistantRateLimitedEvent | AssistantHandoffOfferedEvent | AssistantStreamErrorEvent | StreamCompletedEvent;

export interface AssistantDurableEventDto { eventType: AssistantInboxEventType.DURABLE_EVENT; outboxId: string; eventId: string; durableType: AssistantDurableEventType; recipientKind: AssistantEventRecipientKind; recipientUserId: string | null; topic: AssistantEventTopic | null; conversationId: string | null; sequence: string | null; aggregateId: string; aggregateVersion: string; cursor: string; createdAt: string }
export interface AssistantEphemeralEventDto { eventType: AssistantInboxEventType.EPHEMERAL_EVENT; ephemeralType: AssistantEphemeralEventType; conversationId: string | null; revision: number | null; createdAt: string }
export interface AssistantResyncRequiredEvent { eventType: AssistantInboxEventType.RESYNC_REQUIRED; reason: AssistantResyncReason }
export interface AssistantAuthExpiredEvent { eventType: AssistantInboxEventType.AUTH_EXPIRED }
export type AssistantInboxEvent = AssistantDurableEventDto | AssistantEphemeralEventDto | AssistantResyncRequiredEvent | AssistantAuthExpiredEvent;
