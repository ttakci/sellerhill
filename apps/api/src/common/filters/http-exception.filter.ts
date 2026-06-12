import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorDetails {
  message?: string;
  error?: string;
  errorCode?: string;
  details?: unknown;
}

interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string;
  error: string | null;
  errorCode?: string;
  details?: unknown;
  requestId?: string;
}

/**
 * Global HTTP Exception Filter
 *
 * Purpose:
 * - Catches all HTTP exceptions
 * - Returns standardized error responses
 * - Logs errors with Winston
 * - Handles both known and unknown errors
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Handle CORS errors — return 403 with clear message instead of generic 500
    if (exception instanceof Error && exception.message?.includes('Not allowed by CORS')) {
      const requestId = request.headers['x-request-id'] as string | undefined;
      const origin = request.headers['origin'];

      this.logger.warn(`CORS rejected origin: ${origin ?? '(none)'} on ${request.method} ${request.url}`);

      const errorResponse: ErrorResponse = {
        statusCode: HttpStatus.FORBIDDEN,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        message: `CORS policy: Origin '${origin ?? 'unknown'}' is not allowed`,
        error: 'Forbidden',
      };
      if (requestId) {
        errorResponse.requestId = requestId;
      }

      response.status(HttpStatus.FORBIDDEN).json(errorResponse);
      return;
    }

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

    // Extract error details including errorCode for i18n
    const errorDetails: ErrorDetails = typeof message === 'object' ? (message as ErrorDetails) : {};

    // Get request ID from headers
    const requestId = request.headers['x-request-id'] as string | undefined;

    const errorResponse: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: typeof message === 'string' ? message : errorDetails.message ?? 'Internal server error',
      error: typeof message === 'string' ? null : errorDetails.error ?? null,
    };

    // Add request ID if available
    if (requestId) {
      errorResponse.requestId = requestId;
    }

    // Add optional fields if they exist
    if (errorDetails.errorCode) {
      errorResponse.errorCode = errorDetails.errorCode;
    }
    if (errorDetails.details) {
      errorResponse.details = errorDetails.details;
    }

    // Log the error
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - ${status} - ${JSON.stringify(errorResponse)}`,
        exception instanceof Error ? exception.stack : ''
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} - ${status} - ${JSON.stringify(errorResponse)}`);
    }

    response.status(status).json(errorResponse);
  }
}
