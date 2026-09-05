import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3004),
  FULFILLMENT_DATABASE_URL: z.string().url('FULFILLMENT_DATABASE_URL must be a valid PostgreSQL URL'),
  REDIS_URL: z.string().url('REDIS_URL must be a valid Redis URL'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  SERVICE_TOKEN: z.string().min(16, 'SERVICE_TOKEN must be at least 16 characters'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Fulfillment Service: Invalid environment configuration:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
