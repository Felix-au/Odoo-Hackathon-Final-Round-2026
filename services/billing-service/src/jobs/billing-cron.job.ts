import { SubscriptionRepository } from '../db/repositories/subscription.repository';
import { InvoiceRepository } from '../db/repositories/invoice.repository';
import { BillingEventPublisher } from '../events/publisher';

export class BillingCronJob {
  constructor(
    private subscriptionRepo: SubscriptionRepository,
    private invoiceRepo: InvoiceRepository,
    private eventPublisher: BillingEventPublisher,
  ) {}

  /**
   * Run the daily billing job to find active subscriptions due for billing
   * and generate recurring invoices.
   */
  async runDailyBillingJob(today: Date = new Date()): Promise<{ processed: number; invoiceIds: string[] }> {
    const dueSubs = await this.subscriptionRepo.findDueForBilling(today);
    const invoiceIds: string[] = [];

    for (const sub of dueSubs) {
      // 1. Create recurring invoice
      const invoice = await this.invoiceRepo.create({
        companyId: sub.companyId,
        orderId: sub.orderId,
        customerId: sub.customerId,
        type: 'RECURRING',
        status: 'SENT',
        currency: sub.currency,
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // Net 15
        notes: `Recurring billing cycle for plan ${sub.planName} (${sub.interval})`,
        lines: [
          {
            productId: sub.planId,
            description: `${sub.planName} subscription (${sub.interval})`,
            quantity: sub.quantity,
            unitPrice: Number(sub.unitPrice),
            discountPct: 0,
            taxRate: 0,
            taxAmount: 0,
          },
        ],
      });

      invoiceIds.push(invoice.id);

      // 2. Publish event for analytics
      await this.eventPublisher.publishInvoiceCreated({
        invoiceId: invoice.id,
        orderId: sub.orderId,
        customerId: sub.customerId,
        companyId: sub.companyId,
        amount: Number(invoice.totalAmount),
        currency: invoice.currency,
        type: 'RECURRING',
      });

      await this.eventPublisher.publishSubscriptionRenewed({
        subscriptionId: sub.id,
        orderId: sub.orderId,
        customerId: sub.customerId,
        companyId: sub.companyId,
        amount: Number(invoice.totalAmount),
        period: sub.interval,
      });

      // 3. Advance next billing date
      await this.subscriptionRepo.advanceBillingDate(sub.id);
    }

    return {
      processed: dueSubs.length,
      invoiceIds,
    };
  }
}
