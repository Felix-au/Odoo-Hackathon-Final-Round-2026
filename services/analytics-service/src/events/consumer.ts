import type Redis from 'ioredis';
import type { AnalyticsRepository } from '../db/repositories/analytics.repository';
import type { DealHealthRepository } from '../db/repositories/deal-health.repository';

export class AnalyticsEventConsumer {
  private running = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly redis: Redis | null,
    private readonly analyticsRepo: AnalyticsRepository,
    private readonly dealHealthRepo: DealHealthRepository,
    private readonly streams = [
      'dealflow360:quotation',
      'dealflow360:billing',
      'dealflow360:fulfillment',
    ],
    private readonly group = 'analytics-service',
    private readonly consumer = `analytics-worker-${process.pid}`,
  ) {}

  async start(): Promise<void> {
    if (!this.redis) return;

    for (const stream of this.streams) {
      try {
        await this.redis.xgroup('CREATE', stream, this.group, '0', 'MKSTREAM');
      } catch (err: unknown) {
        if (!(err instanceof Error) || !err.message.includes('BUSYGROUP')) {
          // stream or group ready
        }
      }
    }

    this.running = true;
    this.poll();
  }

  private async poll(): Promise<void> {
    if (!this.running || !this.redis) return;

    try {
      for (const stream of this.streams) {
        const results = (await this.redis.xreadgroup(
          'GROUP',
          this.group,
          this.consumer,
          'COUNT',
          10,
          'BLOCK',
          1000,
          'STREAMS',
          stream,
          '>',
        )) as any;

        if (results && Array.isArray(results)) {
          for (const [_streamKey, messages] of results) {
            for (const [msgId, fields] of messages) {
              const fieldMap: Record<string, string> = {};
              for (let i = 0; i < fields.length; i += 2) {
                fieldMap[fields[i]] = fields[i + 1];
              }

              const eventType = fieldMap['eventType'] || fieldMap['event'];
              const rawPayload = fieldMap['payload'];

              if (eventType && rawPayload) {
                try {
                  const payload = JSON.parse(rawPayload);
                  await this.handleEvent(eventType, payload);
                } catch (err) {
                  console.error(`[AnalyticsConsumer] Failed to handle event ${eventType}:`, err);
                }
              }

              await this.redis.xack(stream, this.group, msgId);
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('NOGROUP')) {
        for (const s of this.streams) {
          try {
            await this.redis.xgroup('CREATE', s, this.group, '0', 'MKSTREAM');
          } catch {}
        }
      } else {
        console.warn('[AnalyticsConsumer] Poll error:', err);
      }
    }

    if (this.running) {
      this.timer = setTimeout(() => this.poll(), 500);
    }
  }

  async handleEvent(eventType: string, payload: any) {
    switch (eventType) {
      case 'quotation.status_changed':
      case 'quotation.confirmed':
      case 'quotation.approved':
      case 'quotation.rejected':
      case 'quotation.negotiation_received': {
        const nextStatus = payload.newStatus ?? payload.status ?? (
          eventType === 'quotation.confirmed' ? 'CONFIRMED' :
          eventType === 'quotation.approved' ? 'APPROVED' :
          eventType === 'quotation.rejected' ? 'REJECTED' :
          eventType === 'quotation.negotiation_received' ? 'UNDER_NEGOTIATION' :
          'DRAFT'
        );
        await this.analyticsRepo.upsertQuotationSnapshot({
          id: payload.quotationId,
          companyId: payload.companyId ?? 'default',
          repId: payload.repId ?? 'unknown',
          repName: payload.repName ?? 'Sales Rep',
          customerId: payload.customerId ?? 'unknown',
          customerName: payload.customerName ?? 'Customer',
          customerTier: payload.customerTier ?? 'STANDARD',
          status: nextStatus,
          totalAmount: Number(payload.totalAmount ?? 0),
          totalMarginPct: Number(payload.totalMarginPct ?? 0),
          blendedRiskScore: Number(payload.blendedRiskScore ?? 0),
          currency: payload.currency ?? 'USD',
          lastActivityAt: payload.confirmedAt ? new Date(payload.confirmedAt) : new Date(),
          confirmedAt: payload.confirmedAt ? new Date(payload.confirmedAt) : (nextStatus === 'CONFIRMED' ? new Date() : null),
          lines: payload.lines
            ? payload.lines.map((l: any) => ({
                productId: l.productId,
                productName: l.productName || l.description || 'Product',
                categoryId: l.categoryId,
                categoryName: l.categoryName,
                discountPct: l.discountPct ?? 0,
                lineTotal: Number(l.lineTotal ?? l.unitPrice * (l.quantity || 1)),
                marginPct: l.marginPct ?? 0,
              }))
            : undefined,
        });
        break;
      }

      case 'billing.invoice_paid': {
        await this.analyticsRepo.upsertInvoiceSnapshot({
          id: payload.invoiceId,
          companyId: payload.companyId ?? 'default',
          orderId: payload.orderId,
          customerId: payload.customerId,
          type: payload.type ?? 'ONE_TIME',
          status: 'PAID',
          amount: Number(payload.amount),
          currency: payload.currency ?? 'USD',
          paidAt: payload.paidAt ? new Date(payload.paidAt) : new Date(),
        });
        break;
      }

      case 'billing.subscription_renewed': {
        await this.analyticsRepo.upsertSubscriptionSnapshot({
          id: payload.subscriptionId,
          companyId: payload.companyId ?? 'default',
          orderId: payload.orderId,
          customerId: payload.customerId,
          planName: payload.planName ?? 'Subscription Plan',
          interval: payload.period ?? 'MONTHLY',
          quantity: payload.quantity ?? 1,
          unitPrice: Number(payload.amount),
          status: 'ACTIVE',
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
        break;
      }

      case 'fulfillment.shipment_delayed': {
        // REQ-F-152: Delivery promise slippage
        await this.dealHealthRepo.upsertAlert({
          companyId: payload.companyId ?? 'default',
          quotationId: payload.orderId || payload.quotationId,
          type: 'DELIVERY_SLIPPAGE',
          severity: 'HIGH',
          message: `Shipment for order #${payload.orderId || payload.quotationId} is ${payload.daysDelayed ?? 3} days past expected ship date`,
        });
        break;
      }
    }
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
