import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  AUTH_DATABASE_URL: z.string().url('AUTH_DATABASE_URL must be a valid PostgreSQL URL'),
  REDIS_URL: z.string().url('REDIS_URL must be a valid Redis URL'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRY: z.coerce.number().default(28800),    // 8 hours in seconds
  JWT_REFRESH_EXPIRY: z.coerce.number().default(2592000), // 30 days in seconds
  MAGIC_LINK_TTL_SECONDS: z.coerce.number().default(86400),       // 24 hours
  PORTAL_SESSION_TTL_SECONDS: z.coerce.number().default(604800),  // 7 days
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_FROM: z.string().email().default('no-reply@dealflow360.dev'),
  APP_BASE_URL: z.string().url().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

// Parse and validate at module load — exits with clear error if any var is missing/invalid
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Auth Service: Invalid environment configuration:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
