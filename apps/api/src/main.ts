import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { winstonLogger } from './common/config/logger.config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: winstonLogger,
    // Capture the raw request body so webhook signature verification can run
    // against the exact bytes the provider sent (Paddle signs the literal
    // body). The raw body is stashed on `req.rawBody` as a Buffer for routes
    // that opt in via `@Req()`. JSON parsing still happens for other routes.
    rawBody: true,
  });

  // HttpOnly refresh-token cookies (auth)
  app.use(cookieParser());

  // Enable API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Security headers with enhanced configuration
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    })
  );

  // Response compression (gzip/brotli)
  app.use(
    compression({
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      threshold: 1024, // Only compress responses larger than 1KB
    })
  );

  // CORS: prefer CORS_ORIGINS (comma-separated); fall back to legacy CORS_ORIGIN,
  // then FRONTEND_URL (the single-domain deploys' own web origin), then localhost
  // for local dev. FRONTEND_URL is the safety net for Coolify deploys where the
  // panel's CORS_ORIGINS row was left blank — an explicitly-empty env var still
  // reaches process.env as '', so this must be resolved in code, not only via the
  // compose file's own `${CORS_ORIGINS:-${FRONTEND_URL}}` default (Coolify can
  // inject its panel variables directly into the container, bypassing compose
  // interpolation entirely).
  // Same-origin requests (no Origin header) are always allowed (nginx same-host proxy).
  const allowedOrigins = (
    process.env.CORS_ORIGINS ||
    process.env.CORS_ORIGIN ||
    process.env.FRONTEND_URL ||
    'http://localhost:5173'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        winstonLogger.warn(`[CORS] Blocked origin: ${origin} (allowed: [${allowedOrigins.join(', ')}])`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-API-Version'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    maxAge: 86400,
  });

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global validation pipe with enhanced settings
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: {
        target: false,
        value: false,
      },
    })
  );

  // Global logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Global API prefix
  app.setGlobalPrefix('api');

  // Swagger/OpenAPI Documentation
  const config = new DocumentBuilder()
    .setTitle('Template API')
    .setDescription(
      'Production-ready NestJS API template with best practices. Includes examples for CRUD operations, validation, error handling, and logging.'
    )
    .setVersion('1.0.0')
    .addTag('examples', 'Example CRUD operations')
    .addTag('health', 'Health check endpoints')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token',
      },
      'JWT'
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Template API Docs',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  const host = process.env.HOST || '0.0.0.0';
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port, host);

  winstonLogger.log(`🚀 API is running on: http://${host}:${port}/api`);
  winstonLogger.log(`📚 API Documentation: http://localhost:${port}/api/docs`);

  // Graceful shutdown handlers
  const gracefulShutdown = async (signal: string) => {
    winstonLogger.log(`⚠️  Received ${signal}, starting graceful shutdown...`);

    try {
      await app.close();
      winstonLogger.log('✅ Application closed successfully');
      process.exit(0);
    } catch (error) {
      winstonLogger.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Handle termination signals
  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    winstonLogger.error('❌ Uncaught Exception:', error);
    void gracefulShutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    winstonLogger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    void gracefulShutdown('unhandledRejection');
  });
}

void bootstrap();
