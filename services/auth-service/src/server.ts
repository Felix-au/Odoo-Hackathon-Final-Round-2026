import { buildApp } from './app';
import { env } from './config/env';

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`Auth Service running on port ${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received — shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received — shutting down gracefully...');
  process.exit(0);
});

void main();
