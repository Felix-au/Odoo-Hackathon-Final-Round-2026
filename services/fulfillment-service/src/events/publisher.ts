import Redis from 'ioredis';

export interface DomainEvent {
  eventType: string;
  version: string;
  companyId: string;
  payload: Record<string, unknown>;
}

export class EventPublisher {
  constructor(private readonly redis: Redis) {}

  async publish(stream: string, event: DomainEvent): Promise<string> {
    const eventId = await this.redis.xadd(
      stream,
      '*',
      'eventType', event.eventType,
      'version', event.version,
      'companyId', event.companyId,
      'payload', JSON.stringify(event.payload),
      'publishedAt', new Date().toISOString(),
    );
    return eventId ?? '';
  }
}
