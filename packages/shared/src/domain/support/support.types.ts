import type { SupportAgentAvailability, SupportAgentPresenceStatus, SupportCapacityStatus } from './support.enums';
export interface SupportPresenceState { availability: SupportAgentAvailability; presence: SupportAgentPresenceStatus; capacityStatus: SupportCapacityStatus; connectionCount: number; lastHeartbeatAt: string | null }
