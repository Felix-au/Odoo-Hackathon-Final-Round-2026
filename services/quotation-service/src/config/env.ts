import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3003),
  QUOTATION_DATABASE_URL: z.string().default('postgresql://dealflow:dealflow_dev@localhost:5434/quotation_db'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters').default('dev_jwt_secret_change_in_prod_must_be_64_chars_minimum_dev_only_x'),
  SERVICE_TOKEN: z.string().default('dev_service_token_for_internal_calls_min_16'),
  CATALOG_SERVICE_URL: z.string().default('http://localhost:3002'),
  FULFILLMENT_SERVICE_URL: z.string().default('http://localhost:3004'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_FROM: z.string().default('no-reply@dealflow360.dev'),
  APP_BASE_URL: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Quotation Service: Invalid environment configuration:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
