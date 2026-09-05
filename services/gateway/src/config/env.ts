import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  // Upstream service URLs
  AUTH_SERVICE_URL: z.string().url(),
  CATALOG_SERVICE_URL: z.string().url(),
  QUOTATION_SERVICE_URL: z.string().url(),
  FULFILLMENT_SERVICE_URL: z.string().url(),
  BILLING_SERVICE_URL: z.string().url(),
  ANALYTICS_SERVICE_URL: z.string().url(),

  // JWT secret (shared across all services)
  JWT_SECRET: z.string().min(32),

  // Redis for portal session lookup
  REDIS_URL: z.string().url(),

  // CORS
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env;

export function getEnv(): Env {
  if (!_env) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error('❌ Invalid environment variables:\n', result.error.flatten().fieldErrors);
      process.exit(1);
    }
    _env = result.data;
  }
  return _env;
}

export const env = new Proxy({} as Env, {
  get(_target, prop: string) {
    return getEnv()[prop as keyof Env];
  },
});
