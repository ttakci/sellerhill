import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

import { RedisKeyService } from './redis-key';
import { AppRedisOptions, REDIS_OPTIONS } from './redis.config';

@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  readonly command: Redis;
  readonly publisher: Redis;
  readonly subscriber: Redis;
  readonly keys: RedisKeyService;
  private readonly scripts = new Map<string, { source: string; sha?: string }>();

  constructor(@Inject(REDIS_OPTIONS) options: AppRedisOptions) {
    const { keyPrefix, ...connection } = options;
    this.keys = new RedisKeyService(keyPrefix);
    this.command = new Redis(connection);
    this.publisher = new Redis(connection);
    this.subscriber = new Redis(connection);
  }

  async onModuleInit(): Promise<void> {
    await Promise.all([this.connect(this.command), this.connect(this.publisher), this.connect(this.subscriber)]);
  }

  registerScript(name: string, source: string): void {
    this.scripts.set(name, { source });
  }

  async runScript(name: string, keys: string[], args: Array<string | number>): Promise<unknown> {
    const script = this.scripts.get(name);
    if (!script) {throw new Error(`Redis script is not registered: ${name}`);}
    if (!script.sha) {script.sha = String(await this.command.script('LOAD', script.source));}
    try {
      return await this.command.evalsha(script.sha, keys.length, ...keys, ...args.map(String));
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('NOSCRIPT')) {throw error;}
      script.sha = String(await this.command.script('LOAD', script.source));
      return this.command.evalsha(script.sha, keys.length, ...keys, ...args.map(String));
    }
  }

  isReady(): boolean {
    return [this.command, this.publisher, this.subscriber].every((client) => client.status === 'ready');
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled([this.quit(this.subscriber), this.quit(this.publisher), this.quit(this.command)]);
  }

  private async connect(client: Redis): Promise<void> {
    client.on('error', (error) => this.logger.error('Redis client error', error));
    if (client.status === 'wait') {await client.connect();}
  }

  private quit(client: Redis): Promise<void> {
    if (client.status !== 'end') {
      client.disconnect();
    }

    return Promise.resolve();
  }
}
