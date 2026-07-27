import { Injectable } from '@nestjs/common';
import { AssistantEventRecipientKind, AssistantEventTopic, UserRole } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { RedisService } from '../../common/redis/redis.service';

import { AssistantOutboxRepository, AssistantOutboxRow } from './repositories/assistant-outbox.repository';

export interface AssistantEventSubscriber {
  userId: string;
  role: UserRole;
  afterId: string;
  onEvent(event: AssistantOutboxRow): Promise<void> | void;
}

@Injectable()
export class AssistantEventService {
  private readonly channel: string;
  private readonly subscribers = new Set<AssistantEventSubscriber>();

  constructor(private readonly database: DatabaseService, private readonly redis: RedisService,
    private readonly outbox: AssistantOutboxRepository) {
    this.channel = redis.keys.key('assistant', 'events');
    redis.subscriber.on('message', (channel, id) => {
      if (channel === this.channel) { void this.deliver(id); }
    });
  }

  async initialize(): Promise<void> { await this.redis.subscriber.subscribe(this.channel); }

  async subscribe(subscriber: AssistantEventSubscriber): Promise<() => void> {
    const highWatermark = await this.outbox.highWatermark();
    const buffered: AssistantOutboxRow[] = [];
    const live: AssistantEventSubscriber = { ...subscriber, onEvent: (event) => { buffered.push(event); } };
    this.subscribers.add(live);
    const replay = await this.outbox.replay(subscriber.userId, subscriber.role === UserRole.SUPPORT || subscriber.role === UserRole.ADMIN,
      subscriber.afterId, highWatermark);
    for (const event of replay) { await subscriber.onEvent(event); }
    buffered.sort((a, b) => Number(BigInt(a.id) - BigInt(b.id)));
    const seen = new Set(replay.map((event) => event.id));
    for (const event of buffered) { if (!seen.has(event.id)) { await subscriber.onEvent(event); } }
    live.onEvent = (event) => subscriber.onEvent(event);
    return () => this.subscribers.delete(live);
  }

  async publish(eventId: string): Promise<void> { await this.redis.publisher.publish(this.channel, eventId); }

  private async deliver(id: string): Promise<void> {
    const event = await this.outbox.findById(id);
    if (!event) { return; }
    for (const subscriber of this.subscribers) {
      const authorized = event.recipientKind === AssistantEventRecipientKind.USER
        ? event.recipientUserId === subscriber.userId
        : event.recipientTopic === AssistantEventTopic.SUPPORT_QUEUE
          && await this.hasSupportRole(subscriber.userId);
      if (authorized) { await subscriber.onEvent(event); }
    }
  }

  private async hasSupportRole(userId: string): Promise<boolean> {
    const rows = await this.database.query<{ role: UserRole }>('SELECT role FROM users WHERE id=$1', [userId]);
    return rows[0]?.role === UserRole.SUPPORT || rows[0]?.role === UserRole.ADMIN;
  }
}
