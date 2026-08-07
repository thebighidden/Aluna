import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmailResult {
  sent: boolean;
  error?: string;
}

/**
 * Resend REST transport. Kept deliberately thin: no SDK, no retries, and a hard "not configured"
 * result so callers can persist a notification even when email is unavailable.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey?: string;
  private readonly from: string;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('RESEND_API_KEY')?.trim() || undefined;
    this.from = this.config.get<string>('MAIL_FROM')?.trim() || 'Aluna <onboarding@resend.dev>';
  }

  get configured(): boolean {
    return Boolean(this.apiKey);
  }

  async send(input: { to: string; subject: string; body: string }): Promise<EmailResult> {
    if (!this.apiKey) {
      return { sent: false, error: 'RESEND_API_KEY is not configured' };
    }
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: [input.to],
          subject: input.subject,
          text: input.body,
          html: this.html(input.subject, input.body),
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        const error = payload.message || `Resend returned HTTP ${response.status}`;
        this.logger.warn(`Email to ${input.to} failed: ${error}`);
        return { sent: false, error };
      }
      return { sent: true };
    } catch (caught) {
      const error = caught instanceof Error ? caught.message : String(caught);
      this.logger.error(`Email to ${input.to} failed`, caught);
      return { sent: false, error };
    }
  }

  private html(subject: string, body: string): string {
    const escaped = body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .split(/\n{2,}/)
      .map((paragraph) => `<p style="margin:0 0 16px">${paragraph.replace(/\n/g, '<br>')}</p>`)
      .join('');
    return `<!doctype html><html><body style="margin:0;background:#faf9f7;padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px">
<tr><td style="padding:28px 28px 8px;font:700 18px/1.3 system-ui,sans-serif;color:#1a1a1f">${subject}</td></tr>
<tr><td style="padding:0 28px 28px;font:400 14px/1.6 system-ui,sans-serif;color:#3c3c46">${escaped}</td></tr>
<tr><td style="padding:0 28px 24px;font:400 12px/1.5 system-ui,sans-serif;color:#8a8a96">Sent by Aluna Studio.</td></tr>
</table></body></html>`;
  }
}
