import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * HTTP Logging Interceptor
 *
 * Purpose:
 * - Logs all incoming HTTP requests
 * - Logs response time and status code
 * - Useful for debugging and monitoring
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body } = request;
    const userAgent = request.get('user-agent') || '';
    const ip = request.ip;
    const requestId = request.headers['x-request-id'] || 'N/A';

    const now = Date.now();

    this.logger.log(`[${requestId}] Incoming Request: ${method} ${url} - IP: ${ip} - User Agent: ${userAgent}`);

    // Log request body for non-GET requests (excluding sensitive data)
    if (method !== 'GET' && Object.keys(body).length > 0) {
      const sanitizedBody = this.sanitizeBody(body);
      this.logger.debug(`[${requestId}] Request Body: ${JSON.stringify(sanitizedBody)}`);
    }

    return next.handle().pipe(
      tap({
        next: (_data: any) => {
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode;
          const responseTime = Date.now() - now;

          this.logger.log(`[${requestId}] Response: ${method} ${url} - Status: ${statusCode} - ${responseTime}ms`);
        },
        error: (error: any) => {
          const responseTime = Date.now() - now;
          this.logger.error(`[${requestId}] Error: ${method} ${url} - ${error.message} - ${responseTime}ms`);
        },
      })
    );
  }

  /**
   * Sanitize request body to remove sensitive information
   */
  private sanitizeBody(body: any): any {
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'creditCard'];
    const sanitized = { ...body };

    Object.keys(sanitized).forEach((key) => {
      if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
        sanitized[key] = '***REDACTED***';
      }
    });

    return sanitized;
  }
}
