import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

import { getRedisOptions } from '../../src/common/redis/redis.config';
import { RedisService } from '../../src/common/redis/redis.service';

const databaseUrl = process.env.INTEGRATION_DATABASE_URL ?? 'postgresql://sellerhill_test:sellerhill_test@localhost:55432/sellerhill_integration_test';
const redisPort = Number(process.env.INTEGRATION_REDIS_PORT ?? 56379);

if (!new URL(databaseUrl).pathname.includes('integration_test')) {
  throw new Error('Integration database name must contain integration_test');
}

describe('infrastructure', () => {
  it('provides pgvector operators and metric opclasses', async () => {
    const pool = new Pool({ connectionString: databaseUrl });
    try {
      const result = await pool.query<{
        cosine: number;
        l2: number;
        inner_product: number;
        opclass_count: string;
      }>(`
        SELECT
          '[1,0]'::vector <=> '[0,1]'::vector AS cosine,
          '[1,0]'::vector <-> '[0,1]'::vector AS l2,
          '[1,0]'::vector <#> '[0,1]'::vector AS inner_product,
          (SELECT COUNT(*) FROM pg_opclass WHERE opcname IN ('vector_cosine_ops', 'vector_l2_ops', 'vector_ip_ops')) AS opclass_count
      `);
      expect(result.rows[0].cosine).toBeCloseTo(1);
      expect(result.rows[0].l2).toBeCloseTo(Math.SQRT2);
      expect(result.rows[0].inner_product).toBeCloseTo(0);
      expect(Number(result.rows[0].opclass_count)).toBeGreaterThanOrEqual(3);
    } finally {
      await pool.end();
    }
  });

  it('supports isolated pub/sub, NOSCRIPT reload, reconnect and cleanup', async () => {
    const options = getRedisOptions(
      new ConfigService({ REDIS_HOST: 'localhost', REDIS_PORT: redisPort, REDIS_DB: 0, REDIS_KEY_PREFIX: 'integration' })
    );
    const first = new RedisService(options);
    const second = new RedisService(options);
    await Promise.all([first.onModuleInit(), second.onModuleInit()]);
    const channel = first.keys.key('events');
    const received = new Promise<string>((resolve) => second.subscriber.once('message', (_channel, message) => resolve(message)));
    try {
      await second.subscriber.subscribe(channel);
      await first.publisher.publish(channel, 'ready');
      await expect(received).resolves.toBe('ready');

      first.registerScript('increment', "return redis.call('INCRBY', KEYS[1], ARGV[1])");
      const counter = first.keys.key(`counter:${Date.now()}`);
      await expect(first.runScript('increment', [counter], [2])).resolves.toBe(2);
      await first.command.script('FLUSH');
      await expect(first.runScript('increment', [counter], [3])).resolves.toBe(5);

      const disconnected = new Promise<void>((resolve) => first.command.once('end', resolve));
      first.command.disconnect(false);
      await disconnected;
      await first.command.connect();
      await expect(first.command.ping()).resolves.toBe('PONG');
    } finally {
      const firstEnded = new Promise<void>((resolve) => first.command.once('end', resolve));
      const secondEnded = new Promise<void>((resolve) => second.command.once('end', resolve));
      await Promise.all([first.onApplicationShutdown(), second.onApplicationShutdown(), firstEnded, secondEnded]);
    }
    expect([first.command.status, second.command.status]).toEqual(['end', 'end']);
  });
});
