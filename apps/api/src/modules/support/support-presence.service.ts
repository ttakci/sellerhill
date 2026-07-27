import { Injectable } from '@nestjs/common';
import { SupportAgentAvailability, SupportAgentPresenceStatus, SupportAssignmentStatus, SupportCapacityStatus, SupportPresenceState } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { RedisService } from '../../common/redis/redis.service';

const PRESENCE_TTL_SECONDS = 45;
const DEFAULT_CAPACITY = 5;

@Injectable()
export class SupportPresenceService {
  constructor(private readonly redis: RedisService, private readonly database: DatabaseService) {}

  async heartbeat(userId: string, connectionId: string, availability?: SupportAgentAvailability): Promise<SupportPresenceState> {
    const connectionKey = this.redis.keys.key('support', 'presence', userId, connectionId);
    const availabilityKey = this.redis.keys.key('support', 'availability', userId);
    const connectionsKey = this.redis.keys.key('support', 'connections', userId);
    const now = Date.now();
    const multi = this.redis.command.multi();
    multi.set(connectionKey, String(now), 'EX', PRESENCE_TTL_SECONDS);
    multi.zadd(connectionsKey, now, connectionId);
    multi.zremrangebyscore(connectionsKey, 0, now - PRESENCE_TTL_SECONDS * 1000);
    multi.expire(connectionsKey, PRESENCE_TTL_SECONDS * 2);
    if (availability) { multi.set(availabilityKey, availability, 'EX', PRESENCE_TTL_SECONDS * 2); }
    await multi.exec();
    return this.get(userId);
  }

  async disconnect(userId: string, connectionId: string): Promise<SupportPresenceState> {
    await this.redis.command.multi().del(this.redis.keys.key('support', 'presence', userId, connectionId))
      .zrem(this.redis.keys.key('support', 'connections', userId), connectionId).exec();
    return this.get(userId);
  }

  async get(userId: string): Promise<SupportPresenceState> {
    const now = Date.now();
    const connectionsKey = this.redis.keys.key('support', 'connections', userId);
    await this.redis.command.zremrangebyscore(connectionsKey, 0, now - PRESENCE_TTL_SECONDS * 1000);
    const [count, stored, active] = await Promise.all([
      this.redis.command.zcard(connectionsKey),
      this.redis.command.get(this.redis.keys.key('support', 'availability', userId)),
      this.database.query<{ count: string }>('SELECT COUNT(*)::text count FROM support_assignments WHERE support_user_id=$1 AND status=$2', [userId, SupportAssignmentStatus.ACTIVE]),
    ]);
    const availability = Object.values(SupportAgentAvailability).includes(stored as SupportAgentAvailability)
      ? stored as SupportAgentAvailability : SupportAgentAvailability.AVAILABLE;
    const presence = count === 0 ? SupportAgentPresenceStatus.OFFLINE
      : availability === SupportAgentAvailability.AVAILABLE ? SupportAgentPresenceStatus.ONLINE_AVAILABLE
        : SupportAgentPresenceStatus.ONLINE_AWAY;
    const capacityStatus = presence !== SupportAgentPresenceStatus.ONLINE_AVAILABLE ? SupportCapacityStatus.UNAVAILABLE
      : Number(active[0]?.count ?? 0) >= DEFAULT_CAPACITY ? SupportCapacityStatus.AT_CAPACITY : SupportCapacityStatus.AVAILABLE;
    return { availability, presence, capacityStatus, connectionCount: count,
      lastHeartbeatAt: count > 0 ? new Date(now).toISOString() : null };
  }
}
