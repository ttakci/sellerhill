import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Transporter } from 'nodemailer';
import * as nodemailer from 'nodemailer';

import { DatabaseService } from '../../common/database/database.service';

interface EmailTemplate {
  id: string;
  template_key: string;
  locale: string;
  subject: string;
  html_content: string;
  text_content: string | null;
  variables: string[];
}

/**
 * Email Service
 * Handles all email sending operations using Nodemailer + Gmail SMTP
 * Templates are stored in PostgreSQL database for easy management
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter!: Transporter;

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService
  ) {
    this.initializeTransporter();
  }

  /**
   * Initialize Nodemailer transporter with Gmail SMTP
   */
  private initializeTransporter(): void {
    const smtpHost = this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com');
    const smtpPort = this.configService.get<number>('SMTP_PORT', 587);
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');
    const smtpPassword = this.configService.get<string>('SMTP_PASSWORD');
    const smtpFrom = this.configService.get<string>('SMTP_FROM');
    const smtpSecure = this.configService.get<boolean>('SMTP_SECURE');

    this.logger.debug('Email configuration debug:', {
      SMTP_HOST: smtpHost,
      SMTP_PORT: smtpPort,
      SMTP_USER: smtpUser,
      SMTP_PASS_EXISTS: !!smtpPass,
      SMTP_PASS_LENGTH: smtpPass?.length,
      SMTP_PASSWORD_EXISTS: !!smtpPassword,
      SMTP_PASSWORD_LENGTH: smtpPassword?.length,
      SMTP_FROM: smtpFrom,
      SMTP_SECURE: smtpSecure,
    });

    const finalPass = smtpPass || smtpPassword;

    if (!smtpUser || !finalPass) {
      this.logger.warn(
        `SMTP credentials missing. USER: ${smtpUser ? 'OK' : 'MISSING'}, PASS/PASSWORD: ${finalPass ? 'OK' : 'MISSING'}`
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure ?? false,
      auth: {
        user: smtpUser,
        pass: finalPass,
      },
    });

    // Verify connection on startup
    this.transporter.verify((error) => {
      if (error) {
        this.logger.error('SMTP Connection Error', error);
      } else {
        this.logger.log(`SMTP Connection verified for: ${smtpUser}`);
      }
    });

    this.logger.log(`Email transporter initialized: ${smtpUser}@${smtpHost}:${smtpPort}`);
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
    if (!this.transporter) {
      throw new Error('Email transporter not configured');
    }

    const template = await this.getTemplate(templateKey, locale);
    if (!template) {
      throw new Error(`Email template not found: ${templateKey}`);
    }

    const subject = this.replaceVariables(template.subject, variables);
    const html = this.replaceVariables(template.html_content, variables);
    const text = template.text_content ? this.replaceVariables(template.text_content, variables) : undefined;

    const smtpFrom = this.configService.get<string>('SMTP_FROM');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const from = smtpFrom || smtpUser || '';

    this.logger.debug(`Email 'from' configuration - SMTP_FROM: ${smtpFrom}, SMTP_USER: ${smtpUser}, resulting from: ${from}`);

    try {
      await this.transporter.sendMail({
        from: `"Zonds" <${from}>`,
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
