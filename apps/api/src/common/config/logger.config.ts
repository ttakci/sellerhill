import { utilities as nestWinstonModuleUtilities, WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

import { getCorrelation } from '../observability/correlation.context';

/**
 * Winston Logger Configuration
 *
 * Features:
 * - Console logging with colors (human-readable, all environments)
 * - JSON file logging with daily rotation (all environments — Promtail tails
 *   apps/api/logs/*.log for the Loki/Grafana log-tracing stack)
 * - Level from LOG_LEVEL env var, falling back to debug (dev) / info (prod)
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

export const correlationFormat = winston.format((info) => {
  const context = getCorrelation();
  if (context.correlationId) {info.correlationId = context.correlationId;}
  if (context.queueName) {info.queueName = context.queueName;}
  if (context.jobId) {info.jobId = context.jobId;}
  return info;
});

// Console transport for development
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    correlationFormat(),
    winston.format.timestamp(),
    winston.format.ms(),
    nestWinstonModuleUtilities.format.nestLike('API', {
      colors: true,
      prettyPrint: true,
    }),
  ),
});

// Daily rotate file transport for errors
const errorFileTransport = new DailyRotateFile({
  filename: 'logs/error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxFiles: '30d',
  maxSize: '20m',
  format: winston.format.combine(
    correlationFormat(),
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
});

// Daily rotate file transport for all logs
const combinedFileTransport = new DailyRotateFile({
  filename: 'logs/combined-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxFiles: '14d',
  maxSize: '20m',
  format: winston.format.combine(
    correlationFormat(),
    winston.format.timestamp(),
    winston.format.json(),
  ),
});

// Create Winston instance
// File transports run in every environment (not just production) so local
// dev also produces JSON logs under apps/api/logs/ for Promtail/Loki to tail.
export const winstonLogger = WinstonModule.createLogger({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  transports: [consoleTransport, errorFileTransport, combinedFileTransport],
});
