import Redis from 'ioredis';
import { env } from '../config/env.js';

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    _redis.on('error', (err: Error) => {
      console.error('[Gateway Redis] Connection error:', err.message);
    });

    _redis.on('connect', () => {
      console.log('[Gateway Redis] Connected');
    });
  }
  return _redis;
}

export async function closeRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit();
    _redis = null;
  }
}
