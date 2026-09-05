import nodemailer from 'nodemailer';
import { env } from '../config/env';

export class EmailClient {
  private readonly transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: false, // Mailpit doesn't use TLS
      ignoreTLS: true,
    });
  }

  async sendMagicLink(to: string, verifyUrl: string): Promise<void> {
    await this.transporter.sendMail({
      from: env.SMTP_FROM,
      to,
      subject: 'Your DealFlow360 Portal Login Link',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a2e;">DealFlow360 — Portal Access</h2>
          <p>Click the link below to access your quotations. This link is valid for 24 hours and can only be used once.</p>
          <a href="${verifyUrl}" style="
            display: inline-block;
            background: #4f46e5;
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: bold;
            margin: 16px 0;
          ">Access My Quotations</a>
          <p style="color: #666; font-size: 12px;">
            If you did not request this link, please ignore this email.<br/>
            Link: <a href="${verifyUrl}">${verifyUrl}</a>
          </p>
        </div>
      `,
      text: `Access your DealFlow360 portal: ${verifyUrl}\n\nThis link expires in 24 hours and can only be used once.`,
    });
  }

  async sendApprovalRequest(to: string, quotationId: string, riskScore: number): Promise<void> {
    await this.transporter.sendMail({
      from: env.SMTP_FROM,
      to,
      subject: `DealFlow360 — Approval Required: Quotation ${quotationId.slice(0, 8)}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a2e;">Approval Required</h2>
          <p>A quotation requires your approval.</p>
          <p><strong>Quotation ID:</strong> ${quotationId}</p>
          <p><strong>Risk Score:</strong> ${riskScore.toFixed(2)}</p>
          <a href="${env.APP_BASE_URL}/app/quotations/${quotationId}" style="
            display: inline-block;
            background: #dc2626;
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: bold;
          ">Review Quotation</a>
        </div>
      `,
      text: `Quotation ${quotationId} requires your approval. Risk score: ${riskScore.toFixed(2)}. Review at: ${env.APP_BASE_URL}/app/quotations/${quotationId}`,
    });
  }
}
