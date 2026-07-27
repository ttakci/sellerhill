import type { AssistantGroundingConfidence, AssistantToolName } from './assistant.enums';

export interface AssistantToolRequest { name: AssistantToolName; resourceId?: string; period?: string; limit?: number }
export interface AssistantContextPlan { retrievalRequired: boolean; tools: AssistantToolRequest[]; handoffRecommended: boolean }
export interface AssistantSignedCursorPayload { v: 1; sub: string; after: string; iat: number; exp: number; scope: import('./assistant.enums').AssistantCursorScope }
export interface AssistantGroundingResult { confidence: AssistantGroundingConfidence; localeFallbackUsed: boolean; citationCount: number }
