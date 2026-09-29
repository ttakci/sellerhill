import { EbayConversationType } from '@repo/shared';

export const NEW_MESSAGE_TOPIC = 'NEW_MESSAGE';

export interface ParsedEbayNotification {
  notificationId: string;
  topic: string;
  eventDate: string | null;
  publishAttemptCount: number;
  data: Record<string, unknown>;
}

export interface NewMessageData {
  messageId: string;
  conversationId: string;
  conversationType: EbayConversationType;
  recipientUserName: string;
  senderUserName: string | null;
  readStatus: boolean;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

export function parseNotificationEnvelope(body: unknown): ParsedEbayNotification | null {
  if (!isRecord(body) || !isRecord(body.notification)) {return null;}
  const metadata = isRecord(body.metadata) ? body.metadata : {};
  const notificationId = str(body.notification.notificationId);
  const topic = str(metadata.topic);
  if (!notificationId || !topic) {return null;}
  const attempt = body.notification.publishAttemptCount;
  return {
    notificationId,
    topic,
    eventDate: str(body.notification.eventDate),
    publishAttemptCount: typeof attempt === 'number' ? attempt : 1,
    data: isRecord(body.notification.data) ? body.notification.data : {},
  };
}

export function parseNewMessageData(data: Record<string, unknown>): NewMessageData | null {
  const messageId = str(data.messageId);
  const conversationId = str(data.conversationId);
  const recipientUserName = str(data.recipientUserName);
  const type = str(data.conversationType);
  if (!messageId || !conversationId || !recipientUserName || !type) {return null;}
  if (!(Object.values(EbayConversationType) as string[]).includes(type)) {return null;}
  return {
    messageId,
    conversationId,
    conversationType: type as EbayConversationType,
    recipientUserName,
    senderUserName: str(data.senderUserName),
    readStatus: data.readStatus === true,
  };
}

/** `/commerce/notification/v1/destination/abc` (or absolute, trailing slash, query) → 'abc'; undefined when unreadable. */
export function extractIdFromLocation(location: unknown): string | undefined {
  if (typeof location !== 'string') {return undefined;}
  const path = location.split('?')[0].replace(/\/+$/, '');
  const last = path.split('/').pop();
  return last && last.length > 0 ? last : undefined;
}

// /^[A-Za-z0-9_-]{32,80}$/
export function isValidNotificationVerificationToken(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{32,80}$/.test(token);
}
