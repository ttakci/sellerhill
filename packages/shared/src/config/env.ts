import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  REDIS_URL: z.string().url(),
  ZON_SCRAPPER_CONCURRENCY: z
    .string()
    .default('1')
    .transform((v) => parseInt(v, 10)),
  ZON_SCRAPPER_TIMEOUT_MS: z
    .string()
    .default('60000')
    .transform((v) => parseInt(v, 10)),
  ZON_SCRAPPER_USE_PROXY: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  PROXY_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const validateEnv = (config: Record<string, unknown>): Env => {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    console.error('❌ Invalid environment variables:', result.error.format());
    throw new Error('Invalid environment variables');
  }
  return result.data;
};
