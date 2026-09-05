import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3002),
  CATALOG_DATABASE_URL: z.string().url('CATALOG_DATABASE_URL must be a valid PostgreSQL URL'),
  REDIS_URL: z.string().url('REDIS_URL must be a valid Redis URL'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  SERVICE_TOKEN: z.string().min(16, 'SERVICE_TOKEN must be at least 16 characters'),
  CATALOG_CACHE_TTL_SECONDS: z.coerce.number().default(300),     // 5 min default
  DISCOUNT_CEILING_CACHE_TTL: z.coerce.number().default(300),    // 5 min
  APPROVAL_CHAIN_CACHE_TTL: z.coerce.number().default(900),      // 15 min
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Catalog Service: Invalid environment configuration:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
