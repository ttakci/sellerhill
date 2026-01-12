/**
 * Request ID Middleware
 *
 * Purpose:
 * - Assigns a unique ID to each incoming request
 * - Enables request tracking across services
 * - Facilitates distributed tracing and debugging
 * - Adds X-Request-ID header to both request and response
 *
 * Usage:
 * - Automatically applied to all routes via AppModule
 * - Can be accessed in controllers/services via request object
 * - Logged automatically by LoggingInterceptor
 *
 * Benefits:
 * - Correlate logs across multiple services
 * - Track request flow in microservices
 * - Debug production issues efficiently
 * - Meet compliance requirements (audit trails)
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Use existing request ID from header or generate new one
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();

    // Store in request object for access in controllers/services
    req.headers['x-request-id'] = requestId;

    // Add to response headers for client tracking
    res.setHeader('X-Request-ID', requestId);

    next();
  }
}
