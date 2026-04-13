/**
 * Audit Log Service
 * Tracks security-sensitive operations for compliance and debugging
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

export type AuditAction =
  | 'LOGIN'
  | 'REGISTER'
  | 'EBAY_CONNECT'
  | 'EBAY_DISCONNECT'
  | 'LISTING_CREATE'
  | 'LISTING_END'
  | 'LISTING_DELETE'
  | 'ORDER_UPDATE'
  | 'PASSWORD_CHANGE'
  | 'SETTINGS_UPDATE';

export interface AuditLogEntry {
  userId?: string;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

@Injectable()
export class AuditLogService implements OnModuleInit {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async onModuleInit() {
    await this.ensureTable();
  }

  private async ensureTable() {
    try {
      await this.databaseService.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          action VARCHAR(50) NOT NULL,
          resource_type VARCHAR(50),
          resource_id VARCHAR(255),
          details JSONB,
          ip_address VARCHAR(45),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.databaseService.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
      `);

      this.logger.log('Audit logs table ensured');
    } catch (error) {
      this.logger.error('Failed to create audit_logs table', error);
    }
  }

  /**
   * Log an audit event
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.databaseService.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          entry.userId || null,
          entry.action,
          entry.resourceType || null,
          entry.resourceId || null,
          entry.details ? JSON.stringify(entry.details) : null,
          entry.ipAddress || null,
        ]
      );
    } catch (error) {
      // Audit logging should never break the main flow
      this.logger.error('Failed to write audit log', error);
    }
  }
}
