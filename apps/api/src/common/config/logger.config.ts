import { utilities as nestWinstonModuleUtilities, WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

/**
 * Winston Logger Configuration
 * 
 * Features:
 * - Console logging with colors (development)
 * - File logging with daily rotation (production)
 * - Different log levels per environment
 * - Structured JSON logs for production
 * - Human-readable logs for development
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

// Console transport for development
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
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
    winston.format.timestamp(),
    winston.format.json(),
  ),
});

// Create Winston instance
export const winstonLogger = WinstonModule.createLogger({
  level: isDevelopment ? 'debug' : 'info',
  transports: isDevelopment
    ? [consoleTransport]
    : [consoleTransport, errorFileTransport, combinedFileTransport],
});
