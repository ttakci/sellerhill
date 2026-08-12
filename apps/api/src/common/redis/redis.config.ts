import { ConfigService } from '@nestjs/config';
import { RedisOptions } from 'ioredis';

export const REDIS_OPTIONS = Symbol('REDIS_OPTIONS');

export interface AppRedisOptions extends RedisOptions {
  keyPrefix: string;
}

export function getRedisOptions(config: ConfigService): AppRedisOptions {
  const url = config.get<string>('REDIS_URL');
  const keyPrefix = config.get<string>('REDIS_KEY_PREFIX', 'sellerhill');
  const common: AppRedisOptions = {
    host: config.get<string>('REDIS_HOST', 'localhost'),
    port: config.get<number>('REDIS_PORT', 6379),
    password: config.get<string>('REDIS_PASSWORD'),
    db: config.get<number>('REDIS_DB', 0),
    keyPrefix,
    lazyConnect: true,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
  };

  if (!url) {return common;}
  const parsed = new URL(url);
  return {
    ...common,
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : common.db,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  };
}

export function getBullRedisOptions(config: ConfigService): RedisOptions {
  const { keyPrefix: _keyPrefix, lazyConnect: _lazyConnect, ...options } = getRedisOptions(config);
  return options;
}
