export enum AssistantParticipantRole { CUSTOMER = 'customer', SUPPORT_AGENT = 'support_agent' }
export enum SupportAssignmentStatus { ACTIVE = 'active', RELEASED = 'released', TRANSFERRED = 'transferred', RESOLVED = 'resolved', RETURNED_TO_AI = 'returned_to_ai' }
export enum SupportAgentAvailability { AVAILABLE = 'available', AWAY = 'away', OFFLINE = 'offline' }
export enum SupportAgentPresenceStatus { ONLINE_AVAILABLE = 'online_available', ONLINE_AWAY = 'online_away', OFFLINE = 'offline' }
export enum SupportCapacityStatus { AVAILABLE = 'available', AT_CAPACITY = 'at_capacity', UNAVAILABLE = 'unavailable' }
export enum SupportQueueFilter { WAITING = 'waiting', ASSIGNED_TO_ME = 'assigned_to_me', OPEN = 'open', RESOLVED = 'resolved', ALL = 'all' }
export enum SupportTransferKind { AGENT = 'agent', QUEUE = 'queue' }
export enum SupportAuditAction { QUEUE_PREVIEWED = 'queue_previewed', CONVERSATION_OPENED = 'conversation_opened', CLAIMED = 'claimed', RELEASED = 'released', TRANSFERRED = 'transferred', MESSAGE_SENT = 'message_sent', MARKED_READ = 'marked_read', RESOLVED = 'resolved', REOPENED_SUPPORT = 'reopened_support', RETURNED_TO_AI = 'returned_to_ai', ROLE_CHANGED = 'role_changed', CAPACITY_CHANGED = 'capacity_changed', AVAILABILITY_CHANGED = 'availability_changed', ADMIN_OVERRIDE = 'admin_override' }
export enum SupportErrorCode { CONVERSATION_NOT_FOUND = 'conversation_not_found', CONVERSATION_ALREADY_CLAIMED = 'conversation_already_claimed', NOT_ASSIGNED = 'not_assigned', READ_ONLY_HISTORY = 'read_only_history', TARGET_NOT_SUPPORT = 'target_not_support', TARGET_NOT_AVAILABLE = 'target_not_available', TARGET_AT_CAPACITY = 'target_at_capacity', TRANSFER_CONFLICT = 'transfer_conflict', ROLE_REQUIRED = 'role_required' }
