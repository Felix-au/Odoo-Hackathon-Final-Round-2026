// tests/setup/env-setup.ts
// This file is loaded by vitest BEFORE any test file imports src/ modules.
// It pre-populates process.env so that config/env.ts validation passes.

process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3004';
process.env['FULFILLMENT_DATABASE_URL'] = 'postgresql://test:test@localhost:5435/test';
process.env['REDIS_URL'] = 'redis://localhost:6379';
process.env['JWT_SECRET'] = 'dev_jwt_secret_change_in_prod_must_be_64_chars_minimum_dev_only_x';
process.env['SERVICE_TOKEN'] = 'dev_service_token_for_internal_calls_min_16';
process.env['LOG_LEVEL'] = 'error';
