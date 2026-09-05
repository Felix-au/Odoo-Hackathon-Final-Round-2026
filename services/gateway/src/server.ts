import { buildApp } from './app.js';
import { env } from './config/env.js';
import { closeRedis } from './plugins/redis.js';

async function start(): Promise<void> {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`API Gateway running on port ${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    await closeRedis();
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`Received ${signal} — shutting down gracefully`);
    await app.close();
    await closeRedis();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void start();
