import { z } from 'zod';

import { UserRole } from '../../domain/auth/auth.types';
import { SupportAgentAvailability, SupportQueueFilter, SupportTransferKind } from '../../domain/support/support.enums';
import { ASSISTANT_MESSAGE_MAX_LENGTH } from '../assistant/assistant.schema';
const uuid = z.uuid();
export const supportQueueQuerySchema = z.object({ cursor: z.string().max(2048).optional(), limit: z.coerce.number().int().min(1).max(100).default(20), filter: z.enum(SupportQueueFilter).optional(), locale: z.enum(['en', 'tr']).optional(), search: z.string().trim().max(160).optional() }).strict();
export const createSupportMessageSchema = z.object({ clientMessageId: uuid, content: z.string().trim().min(1).max(ASSISTANT_MESSAGE_MAX_LENGTH) }).strict();
export const transferSupportConversationSchema = z.object({ kind: z.enum(SupportTransferKind), targetSupportUserId: uuid.optional() }).strict().superRefine((value, context) => { if (value.kind === SupportTransferKind.AGENT && !value.targetSupportUserId) {context.addIssue({ code: 'custom', path: ['targetSupportUserId'], message: 'targetSupportUserId is required' });} if (value.kind === SupportTransferKind.QUEUE && value.targetSupportUserId) {context.addIssue({ code: 'custom', path: ['targetSupportUserId'], message: 'targetSupportUserId is not allowed' });} });
export const updateSupportPresenceSchema = z.object({ availability: z.enum(SupportAgentAvailability), connectionId: uuid }).strict();
export const supportPresenceHeartbeatSchema = z.object({ connectionId: uuid }).strict();
export const updateSupportCapacitySchema = z.object({ capacity: z.number().int().min(1).max(100) }).strict();
export const updateUserRoleSchema = z.object({ role: z.enum(UserRole) }).strict();
