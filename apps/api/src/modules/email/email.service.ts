import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformSettingKey } from '@repo/shared';
import type { Transporter } from 'nodemailer';
import * as nodemailer from 'nodemailer';

import { DatabaseService } from '../../common/database/database.service';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';

interface EmailTemplate {
  id: string;
  template_key: string;
  locale: string;
  subject: string;
  html_content: string;
  text_content: string | null;
  variables: string[];
}

/** SMTP connection settings resolved from platform settings (DB -> env -> default). */
interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

/**
 * Email Service
 *
 * Sends transactional email via Nodemailer; templates live in PostgreSQL.
 *
 * SMTP credentials come from platform settings, so an operator can change the
 * mail host/user/password from the admin panel without a redeploy. The
 * transporter is rebuilt whenever the resolved config changes (detected via a
 * fingerprint), which makes a settings edit take effect on the next send
 * instead of the next restart.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  /** Fingerprint of the config the current transporter was built from. */
  private transporterKey: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly platformSettings: PlatformSettingsService
  ) {}

  /** Resolve SMTP settings; null when credentials are incomplete. */
  private async resolveSmtpConfig(): Promise<SmtpConfig | null> {
    const [host, port, secure, user, pass, from] = await Promise.all([
      this.platformSettings.getString(PlatformSettingKey.SMTP_HOST),
      this.platformSettings.getNumber(PlatformSettingKey.SMTP_PORT),
      this.platformSettings.getBoolean(PlatformSettingKey.SMTP_SECURE),
      this.platformSettings.getString(PlatformSettingKey.SMTP_USER),
      this.platformSettings.getString(PlatformSettingKey.SMTP_PASSWORD),
      this.platformSettings.getString(PlatformSettingKey.SMTP_FROM),
    ]);
    if (!host || !user || !pass) {
      return null;
    }
    return { host, port, secure, user, pass, from: from || user };
  }

  /**
   * Return a transporter for the current settings, rebuilding it when the
   * resolved config differs from the one it was created with. Null means SMTP
   * is not configured — callers surface that instead of silently dropping mail.
   */
  private async getTransporter(): Promise<{ transporter: Transporter; from: string } | null> {
    const config = await this.resolveSmtpConfig();
    if (!config) {
      this.logger.warn('SMTP is not configured (host/user/password missing) — email not sent.');
      return null;
    }
    // The password participates in the fingerprint so a rotation rebuilds the
    // transporter, but it is never logged.
    const key = `${config.host}:${config.port}:${config.secure}:${config.user}:${config.pass.length}:${config.from}`;
    if (!this.transporter || this.transporterKey !== key) {
      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: { user: config.user, pass: config.pass },
      });
      this.transporterKey = key;
      this.logger.log(`Email transporter initialized: ${config.user}@${config.host}:${config.port}`);
    }
    return { transporter: this.transporter, from: config.from };
  }

  /**
   * Verify the current SMTP settings by opening a connection. Used by the
   * admin panel's "test connection" action so an operator can confirm a
   * credential change before relying on it.
   */
  async verifyConnection(): Promise<{ ok: boolean; error: string | null }> {
    try {
      const resolved = await this.getTransporter();
      if (!resolved) {
        return { ok: false, error: 'admin.errors.smtpNotConfigured' };
      }
      await resolved.transporter.verify();
      return { ok: true, error: null };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`SMTP verification failed: ${message}`);
      return { ok: false, error: message };
    }
  }

  /**
   * Get email template from database
   */
  private async getTemplate(templateKey: string, locale: string = 'en'): Promise<EmailTemplate | null> {
    try {
      const templates = await this.databaseService.query<EmailTemplate>(
        `SELECT id, template_key, locale, subject, html_content, text_content, variables
         FROM email_templates
         WHERE template_key = $1 AND locale = $2 AND is_active = true
         LIMIT 1`,
        [templateKey, locale]
      );

      if (templates.length === 0) {
        this.logger.warn(`Email template not found: ${templateKey} (${locale})`);
        return null;
      }

      return templates[0];
    } catch (error) {
      this.logger.error(`Failed to fetch email template: ${templateKey}`, error);
      return null;
    }
  }

  /**
   * Replace variables in template content
   */
  private replaceVariables(content: string, variables: Record<string, string>): string {
    let result = content;

    // Replace {{variableName}} with actual values
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    });

    // Add current year automatically
    result = result.replace(/{{year}}/g, new Date().getFullYear().toString());

    return result;
  }

  /**
   * Send email using template from database
   */
  private async sendTemplatedEmail(
    to: string,
    templateKey: string,
    variables: Record<string, string>,
    locale: string = 'en'
  ): Promise<void> {
    const resolved = await this.getTransporter();
    if (!resolved) {
      throw new Error('Email transporter not configured');
    }

    const template = await this.getTemplate(templateKey, locale);
    if (!template) {
      throw new Error(`Email template not found: ${templateKey}`);
    }

    const subject = this.replaceVariables(template.subject, variables);
    const html = this.replaceVariables(template.html_content, variables);
    const text = template.text_content ? this.replaceVariables(template.text_content, variables) : undefined;

    try {
      await resolved.transporter.sendMail({
        from: `"SellerHill" <${resolved.from}>`,
        to,
        subject,
        html,
        text,
      });

      this.logger.log(`Email sent successfully: ${templateKey} to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email: ${templateKey} to ${to}`, {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        templateKey,
        to,
      });
      throw new Error('Failed to send email');
    }
  }

  /**
   * Send email verification link
   */
  async sendVerificationEmail(
    email: string,
    firstName: string,
    verificationUrl: string,
    locale: string = 'en'
  ): Promise<void> {
    await this.sendTemplatedEmail(
      email,
      'email_verification',
      {
        firstName,
        verificationUrl,
      },
      locale
    );
  }

  /**
   * Send welcome email after successful verification
   */
  async sendWelcomeEmail(email: string, firstName: string, locale: string = 'en'): Promise<void> {
    const dashboardUrl = this.configService.get<string>('FRONTEND_URL', { infer: true }) || 'http://localhost:5173';

    await this.sendTemplatedEmail(
      email,
      'welcome',
      {
        firstName,
        dashboardUrl: `${dashboardUrl}/dashboard`,
      },
      locale
    );
  }
}
