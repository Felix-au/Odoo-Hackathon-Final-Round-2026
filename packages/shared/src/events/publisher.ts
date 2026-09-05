import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import type { BaseEvent } from '../types/events';

/**
 * EventPublisher — publishes events to Redis Streams
 *
 * Usage:
 *   const publisher = new EventPublisher(redis);
 *   await publisher.publish(Streams.QUOTATION, {
 *     eventType: EventTypes.QUOTATION_CONFIRMED,
 *     version: '1.0',
 *     companyId: 'default',
 *     payload: { ... }
 *   });
 */
export class EventPublisher {
  constructor(private readonly redis: Redis) {}

  async publish<T>(
    stream: string,
    event: Omit<BaseEvent<T>, 'eventId' | 'timestamp'>,
  ): Promise<string> {
    const fullEvent: BaseEvent<T> = {
      ...event,
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
    };

    const messageId = await this.redis.xadd(
      stream,
      '*',
      'eventId', fullEvent.eventId,
      'eventType', fullEvent.eventType,
      'version', fullEvent.version,
      'companyId', fullEvent.companyId,
      'timestamp', fullEvent.timestamp,
      'payload', JSON.stringify(fullEvent.payload),
    );

    if (!messageId) {
      throw new Error(`Failed to publish event ${fullEvent.eventType} to stream ${stream}`);
    }

    return messageId;
  }
}
