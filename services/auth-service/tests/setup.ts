/**
 * Vitest setup file — runs before all test files.
 * Sets required env vars so env.ts validation passes on module load.
 */
process.env['AUTH_DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';
process.env['REDIS_URL'] = 'redis://localhost:6379';
process.env['JWT_SECRET'] = 'test-jwt-secret-for-unit-tests-min-32-chars-xx';
process.env['SERVICE_TOKEN'] = 'test-service-token-1234567890';
