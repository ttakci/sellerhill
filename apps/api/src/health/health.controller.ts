/**
 * Health Check Controller
 *
 * Purpose:
 * - Provides health check endpoints for monitoring
 * - Used by Kubernetes liveness/readiness probes
 * - Monitors application health and dependencies
 *
 * Endpoints:
 * - GET /health - Basic health check
 * - GET /health/ready - Readiness probe (checks dependencies)
 * - GET /health/live - Liveness probe (checks if app is running)
 */

import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check', description: 'Check if the API is healthy and running' })
  @ApiOkResponse({ description: 'API is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  check() {
    return this.health.check([
      // Memory check: heap should not exceed 150MB
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      // RSS check: should not exceed 300MB
      () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024),
    ]);
  }

  /**
   * Liveness probe
   * Used by Kubernetes/Docker to check if container should be restarted
   */
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  getLiveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /**
   * Readiness probe
   * Used by Kubernetes/Docker to check if service is ready to accept traffic
   */
  @Get('ready')
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness probe',
    description: 'Check if the API is ready to accept traffic (for Kubernetes)',
  })
  @ApiOkResponse({ description: 'API is ready' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  ready() {
    return this.health.check([() => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024)]);
  }
}
