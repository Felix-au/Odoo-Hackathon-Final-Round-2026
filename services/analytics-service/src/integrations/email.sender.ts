import nodemailer from 'nodemailer';
import { env } from '../config/env';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}

export class EmailSender {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    if (env.NODE_ENV !== 'test') {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: false,
      });
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<{ messageId?: string; success: boolean }> {
    if (!this.transporter) {
      // In test mode or when disabled, log and return success
      return { success: true, messageId: `mock-msg-${Date.now()}` };
    }

    try {
      const info = await this.transporter.sendMail({
        from: env.SMTP_FROM,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.warn('[EmailSender] Failed to send email via SMTP:', err);
      return { success: false };
    }
  }

  async sendNudgeEmail(to: string[], quotationId: string, message: string) {
    return this.sendEmail({
      to,
      subject: `[DealFlow360] Nudge: Action Required on Quotation ${quotationId}`,
      text: `Hello,\n\nA manager has sent a nudge regarding quotation ${quotationId}:\n\n"${message}"\n\nPlease review and follow up.\n\nDealFlow360 Team`,
    });
  }

  async sendEscalationEmail(to: string[], quotationId: string, reason: string) {
    return this.sendEmail({
      to,
      subject: `[DealFlow360] ESCALATION: Quotation ${quotationId} Alert`,
      text: `Urgent attention required.\n\nQuotation ${quotationId} has been escalated for the following reason:\n"${reason}"\n\nPlease inspect the deal in DealFlow360.\n\nDealFlow360 Team`,
    });
  }
}
