/**
 * Audit Log Service
 * Tracks security-sensitive operations for compliance and debugging
 */

import { Injectable, Logger } from '@nestjs/common';

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
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly databaseService: DatabaseService) {}

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
