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
 *
 * DISK BOUNDS — these files are a shipping buffer, not the archive.
 * Promtail tails them into Loki, which owns the queryable history (7 days by
 * default, see docker/loki/loki-config.yml). So the local files only need to
 * survive long enough for Promtail to read them, and keeping two weeks of
 * uncompressed JSON on the API volume was buying nothing: at 500 accounts the
 * combined log runs GBs per day, and `maxFiles: '14d'` is an AGE bound with no
 * size ceiling behind it.
 *
 * Two changes bound it: rotated files are gzipped (~10x on JSON), and the
 * combined log's window now matches Loki's. Promtail is unaffected — it globs
 * `*.log`, and a rotated file becomes `*.log.gz`.
 *
 * Errors are kept longer than combined output: they are small, and they are
 * what you go looking for after the Loki window has closed.
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

/** Parse a positive int env var, falling back when absent or malformed. */
const positiveInt = (raw: string | undefined, fallback: number): number => {
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/** Days of rotated combined logs to keep. Matches Loki's retention by default. */
const combinedRetentionDays = positiveInt(process.env.LOG_COMBINED_RETENTION_DAYS, 7);
/** Days of rotated error logs to keep — small files, worth a longer tail. */
const errorRetentionDays = positiveInt(process.env.LOG_ERROR_RETENTION_DAYS, 30);
/** Size at which a file rotates mid-day; caps any single file. */
const maxFileSize = process.env.LOG_MAX_FILE_SIZE || '20m';

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
  maxFiles: `${errorRetentionDays}d`,
  maxSize: maxFileSize,
  // Gzip rotated files. Promtail globs `*.log`, so a `*.log.gz` is invisible
  // to it — which is correct: it has already shipped those lines to Loki.
  zippedArchive: true,
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
  maxFiles: `${combinedRetentionDays}d`,
  maxSize: maxFileSize,
  zippedArchive: true,
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
