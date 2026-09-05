import type Redis from 'ioredis';
import type { PrismaClient } from '@prisma/client';

export class FulfillmentEventConsumer {
  private running = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly redis: Redis | null,
    private readonly prisma: PrismaClient,
    private readonly stream = 'dealflow360:fulfillment',
    private readonly group = 'quotation-service',
    private readonly consumer = `quotation-worker-${process.pid}`,
  ) {}

  async start(): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.xgroup('CREATE', this.stream, this.group, '$', 'MKSTREAM');
    } catch (err: unknown) {
      if (!(err instanceof Error) || !err.message.includes('BUSYGROUP')) {
        // stream may not exist yet or connection error
      }
    }

    this.running = true;
    this.poll();
  }

  private async poll(): Promise<void> {
    if (!this.running || !this.redis) return;

    try {
      const results = (await this.redis.xreadgroup(
        'GROUP',
        this.group,
        this.consumer,
        'COUNT',
        5,
        'BLOCK',
        2000,
        'STREAMS',
        this.stream,
        '>',
      )) as [string, [string, string[]][]][] | null;

      if (results) {
        for (const [, messages] of results) {
          for (const [messageId, fields] of messages) {
            await this.processMessage(messageId, fields);
          }
        }
      }
    } catch {
      // transient redis error
    }

    if (this.running) {
      this.timer = setTimeout(() => void this.poll(), 1000);
    }
  }

  private async processMessage(messageId: string, fields: string[]): Promise<void> {
    if (!this.redis) return;

    let eventType = '';
    let payloadStr = '';

    for (let i = 0; i < fields.length; i += 2) {
      if (fields[i] === 'eventType') eventType = fields[i + 1] ?? '';
      if (fields[i] === 'payload') payloadStr = fields[i + 1] ?? '';
    }

    if (eventType === 'fulfillment.shipment_delayed' && payloadStr) {
      try {
        const payload = JSON.parse(payloadStr);
        if (payload.orderId) {
          await this.prisma.quotation.updateMany({
            where: { id: payload.orderId },
            data: { lastActivityAt: new Date() },
          });
        }
      } catch {
        // ignore parse error
      }
    }

    try {
      await this.redis.xack(this.stream, this.group, messageId);
    } catch {
      // ignore
    }
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
  }
}
