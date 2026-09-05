import Redis from 'ioredis';

type EventHandler<T = unknown> = (payload: T, eventId: string, eventType: string) => Promise<void>;

/**
 * EventConsumer — consumes events from a Redis Stream using consumer groups.
 *
 * - Uses XREADGROUP for at-least-once delivery with consumer groups.
 * - ACKs after successful handler execution.
 * - Dead-letter: messages pending > maxPendingMs are re-read and re-processed.
 *
 * Usage:
 *   const consumer = new EventConsumer(
 *     redis,
 *     Streams.QUOTATION,       // stream name
 *     'billing-service',        // consumer group
 *     'billing-worker-1',       // consumer name (unique per pod)
 *     new Map([
 *       [EventTypes.QUOTATION_CONFIRMED, handleQuotationConfirmed],
 *     ])
 *   );
 *   await consumer.start();
 */
export class EventConsumer {
  private running = false;
  private readonly pollIntervalMs: number;
  private readonly maxPendingMs: number;
  private readonly batchSize: number;

  constructor(
    private readonly redis: Redis,
    private readonly stream: string,
    private readonly groupName: string,
    private readonly consumerName: string,
    private readonly handlers: Map<string, EventHandler<unknown>>,
    options: {
      pollIntervalMs?: number;
      maxPendingMs?: number;
      batchSize?: number;
    } = {},
  ) {
    this.pollIntervalMs = options.pollIntervalMs ?? 1000;
    this.maxPendingMs = options.maxPendingMs ?? 30_000;
    this.batchSize = options.batchSize ?? 10;
  }

  async start(): Promise<void> {
    // Create consumer group if it doesn't exist ($ = only new messages)
    try {
      await this.redis.xgroup('CREATE', this.stream, this.groupName, '$', 'MKSTREAM');
    } catch (err: unknown) {
      // BUSYGROUP = group already exists — that's fine
      if (!(err instanceof Error) || !err.message.includes('BUSYGROUP')) {
        throw err;
      }
    }

    this.running = true;
    void this.pollLoop();
  }

  stop(): void {
    this.running = false;
  }

  private async pollLoop(): Promise<void> {
    while (this.running) {
      await this.processNewMessages();
      await this.processPendingMessages();
      await this.sleep(this.pollIntervalMs);
    }
  }

  private async processNewMessages(): Promise<void> {
    const results = await this.redis.xreadgroup(
      'GROUP', this.groupName, this.consumerName,
      'COUNT', this.batchSize,
      'BLOCK', 500,
      'STREAMS', this.stream, '>',
    ) as [string, [string, string[]][]][] | null;

    if (!results) return;

    for (const [, messages] of results) {
      for (const [messageId, fields] of messages) {
        await this.processMessage(messageId, fields);
      }
    }
  }

  private async processPendingMessages(): Promise<void> {
    // Re-claim messages that have been pending too long
    const pending = await this.redis.xautoclaim(
      this.stream,
      this.groupName,
      this.consumerName,
      this.maxPendingMs,
      '0-0',
      'COUNT', this.batchSize,
    ) as [string, [string, string[]][], string[]] | null;

    if (!pending) return;
    const [, messages] = pending;
    for (const [messageId, fields] of messages) {
      await this.processMessage(messageId, fields);
    }
  }

  private async processMessage(messageId: string, fields: string[]): Promise<void> {
    // Redis XREADGROUP returns fields as flat [key, value, key, value, ...]
    const fieldMap: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      fieldMap[fields[i]] = fields[i + 1];
    }

    const { eventId, eventType, payload: payloadStr } = fieldMap;
    if (!eventType || !payloadStr) {
      // Malformed message — ACK to skip
      await this.redis.xack(this.stream, this.groupName, messageId);
      return;
    }

    const handler = this.handlers.get(eventType);
    if (!handler) {
      // Unknown event type — ACK to skip (no handler registered)
      await this.redis.xack(this.stream, this.groupName, messageId);
      return;
    }

    try {
      const payload = JSON.parse(payloadStr) as unknown;
      await handler(payload, eventId, eventType);
      await this.redis.xack(this.stream, this.groupName, messageId);
    } catch (err) {
      // Do NOT ACK — message stays pending for retry
      console.error(`[EventConsumer] Failed to process ${eventType} (${messageId}):`, err);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
