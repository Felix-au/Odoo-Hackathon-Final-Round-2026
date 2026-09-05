import { AnalyticsService } from '../domain/services/analytics.service';
import { PrismaClient } from '@prisma/client';

export class DealHealthCronJob {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly prisma: PrismaClient,
    private readonly intervalMs = 30 * 60 * 1000, // 30 minutes
  ) {}

  async runJob(): Promise<{ totalAlerts: number }> {
    // Find all distinct companies
    const companies = await this.prisma.quotationSnapshot.findMany({
      select: { companyId: true },
      distinct: ['companyId'],
    });

    let totalAlerts = 0;
    const companyIds = companies.length > 0 ? companies.map((c) => c.companyId) : ['default'];

    for (const companyId of companyIds) {
      const alerts = await this.analyticsService.runDealHealthCheck(companyId);
      totalAlerts += alerts.length;
    }

    return { totalAlerts };
  }

  start(): void {
    this.running = true;
    this.scheduleNext();
  }

  private scheduleNext(): void {
    if (!this.running) return;
    this.timer = setTimeout(async () => {
      try {
        await this.runJob();
      } catch (err) {
        console.error('[DealHealthCronJob] Execution error:', err);
      }
      this.scheduleNext();
    }, this.intervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
