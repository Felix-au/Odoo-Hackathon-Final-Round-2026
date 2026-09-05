import { buildApp } from './app';
import { env } from './config/env';

async function start() {
  try {
    const app = await buildApp();
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`🚀 Billing Service listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
  } catch (err) {
    console.error('Failed to start Billing Service:', err);
    process.exit(1);
  }
}

start();
