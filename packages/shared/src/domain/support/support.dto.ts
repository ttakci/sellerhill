import type { AssistantConversationDto, AssistantMessageDto } from '../assistant/assistant.dto';
import type { AssistantConversationMode, AssistantConversationStatus } from '../assistant/assistant.enums';
import type { SupportedLocale } from '../common/common.constants';

import type { SupportAgentAvailability, SupportAgentPresenceStatus, SupportAssignmentStatus, SupportAuditAction, SupportCapacityStatus, SupportQueueFilter, SupportTransferKind } from './support.enums';

export interface SupportQueueQuery { cursor?: string; limit?: number; filter?: SupportQueueFilter; locale?: SupportedLocale; search?: string }
export interface SupportQueueConversationDto { id: string; title: string; locale: SupportedLocale; mode: AssistantConversationMode; status: AssistantConversationStatus; waitingSince: string; lastCustomerMessagePreview: string | null; messageCount: number; unreadCount: number; customerDisplayName: string }
export interface SupportConversationListDto { items: SupportQueueConversationDto[]; nextCursor: string | null; total: number }
export interface SupportConversationDetailDto { conversation: AssistantConversationDto; customer: SupportCustomerSummaryDto; assignment: SupportAssignmentDto | null; access: SupportConversationAccessDto }
export interface SupportCustomerSummaryDto { id: string; displayName: string; locale: SupportedLocale; createdAt: string; connectedEbayStoreCount: number; amazonAccountCount: number }
export interface SupportConversationAccessDto { canReadFullHistory: boolean; canReply: boolean; canTransition: boolean; isFormerAssignee: boolean; isAdminOverride: boolean }
export interface SupportAssignmentDto { id: string; conversationId: string; supportUserId: string; status: SupportAssignmentStatus; assignedAt: string; endedAt: string | null; transferredToUserId: string | null }
export interface CreateSupportMessageRequest { clientMessageId: string; content: string }
export interface SupportMessageResponseDto { message: AssistantMessageDto }
export interface TransferSupportConversationRequest { kind: SupportTransferKind; targetSupportUserId?: string }
export interface UpdateSupportPresenceRequest { availability: SupportAgentAvailability; connectionId: string }
export interface SupportPresenceHeartbeatRequest { connectionId: string }
export interface SupportAgentPresenceDto { userId: string; displayName: string; availability: SupportAgentAvailability; presence: SupportAgentPresenceStatus; capacityStatus: SupportCapacityStatus; activeAssignmentCount: number; capacity: number; lastHeartbeatAt: string | null }
export interface UpdateSupportCapacityRequest { capacity: number }
export interface UpdateUserRoleRequest { role: import('../auth/auth.types').UserRole }
export interface SupportAuditDto { id: string; conversationId: string | null; actorUserId: string; action: SupportAuditAction; targetUserId: string | null; createdAt: string }
