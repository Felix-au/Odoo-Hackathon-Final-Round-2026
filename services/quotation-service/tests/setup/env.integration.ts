process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret';
process.env.QUOTATION_DATABASE_URL = process.env.QUOTATION_DATABASE_URL ?? 'postgresql://quot_user:quot_pass@localhost:5432/quotation_test';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
process.env.CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL ?? 'http://localhost:3002';
process.env.FULFILLMENT_SERVICE_URL = process.env.FULFILLMENT_SERVICE_URL ?? 'http://localhost:3004';
process.env.SERVICE_SECRET = process.env.SERVICE_SECRET ?? 'test-service-secret';