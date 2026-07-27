// apps/api/src/modules/admin/admin.controller.ts
//
// Admin Observability & FinOps — read-only endpoints. Every route is gated by
// JwtAuthGuard (authenticate) + RolesGuard (authorize) + PrivilegedSessionGuard
// (per-request session revalidation) + @Roles(UserRole.ADMIN).
// No write/delete endpoints exist on this controller by design; admin actions
// that mutate state go through the owning module's endpoint with its own
// guard chain.
//
// Endpoints (all v1, /admin/*):
//   GET /admin/overview              — counts + usage + queue health (one call)
//   GET /admin/usage/summaries       — usage summaries with optional filters
//   GET /admin/queues/health         — BullMQ queue job counts

import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  QueueEventType,
  UsageEventSource,
  UsageMetric,
  UserRole,
  type AdminBillingMetricsDto,
  type AdminOperationsSummaryDto,
  type AdminOverviewDto,
  type ProviderCostSummaryDto,
  type QueueHealthDto,
  type UserCostSummaryDto,
  type QueueObservationDto,
  type QueueObservationQuery,
  type UsageSummaryDto,
} from '@repo/shared';
import type { Queue } from 'bullmq';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrivilegedSessionGuard } from '../auth/privileged-session.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { AdminService } from './admin.service';

@ApiTags('admin')
@Controller({ path: 'admin', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard, PrivilegedSessionGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    @InjectQueue('order-sync') private readonly orderSyncQueue: Queue,
    @InjectQueue('stock-sync') private readonly stockSyncQueue: Queue,
    @InjectQueue('auto-fulfill') private readonly autoFulfillQueue: Queue,
    @InjectQueue('amazon-order-sync') private readonly amazonOrderSyncQueue: Queue,
    @InjectQueue('amazon-tracking') private readonly amazonTrackingQueue: Queue,
    @InjectQueue('amazon-verify') private readonly amazonVerifyQueue: Queue,
    @InjectQueue('listings') private readonly listingsQueue: Queue,
    @InjectQueue('keepa-refresh') private readonly keepaRefreshQueue: Queue,
  ) {}

  private queues(): Array<{ name: string; queue: Queue }> {
    return [
      { name: 'order-sync', queue: this.orderSyncQueue },
      { name: 'stock-sync', queue: this.stockSyncQueue },
      { name: 'auto-fulfill', queue: this.autoFulfillQueue },
      { name: 'amazon-order-sync', queue: this.amazonOrderSyncQueue },
      { name: 'amazon-tracking', queue: this.amazonTrackingQueue },
      { name: 'amazon-verify', queue: this.amazonVerifyQueue },
      { name: 'listings', queue: this.listingsQueue },
      { name: 'keepa-refresh', queue: this.keepaRefreshQueue },
    ];
  }

  @Get('overview')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Admin overview (observability)',
    description:
      'Top-level counts (users, stores, accounts, listings, recent orders), usage summaries, and BullMQ queue health. Read-only.',
  })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'Usage period start (ISO 8601). Defaults to start of current month.' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'Usage period end (ISO 8601). Defaults to now.' })
  @ApiOkResponse({ description: 'Admin overview retrieved' })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  @ApiForbiddenResponse({ description: 'User is not an admin' })
  async getOverview(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<AdminOverviewDto> {
    return this.adminService.getOverview(this.queues(), from ?? null, to ?? null);
  }

  @Get('usage/summaries')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Usage summaries (FinOps)',
    description:
      'Aggregated usage grouped by (source, metric) for a period, with optional source/metric filters. Read-only.',
  })
  @ApiQuery({ name: 'source', required: false, enum: UsageEventSource })
  @ApiQuery({ name: 'metric', required: false, enum: UsageMetric })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiOkResponse({ description: 'Usage summaries retrieved' })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  @ApiForbiddenResponse({ description: 'User is not an admin' })
  async getUsageSummaries(
    @Query('source') source?: UsageEventSource,
    @Query('metric') metric?: UsageMetric,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<UsageSummaryDto[]> {
    return this.adminService.getUsageSummaries(from ?? null, to ?? null, source, metric);
  }

  @Get('queues/health')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'BullMQ queue health',
    description: 'Job counts (waiting/active/completed/failed/delayed/prioritized) for every registered queue. Read-only.',
  })
  @ApiOkResponse({ description: 'Queue health retrieved' })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  @ApiForbiddenResponse({ description: 'User is not an admin' })
  async getQueueHealth(): Promise<QueueHealthDto[]> {
    return this.adminService.getQueueHealth(this.queues());
  }

  @Get('finops/users')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'User cost summaries' })
  async getUserCosts(@Query('from') from?: string, @Query('to') to?: string): Promise<UserCostSummaryDto[]> {
    return this.adminService.getUserCostSummaries(from ?? null, to ?? null);
  }

  @Get('finops/providers')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Provider cost summaries' })
  async getProviderCosts(@Query('from') from?: string, @Query('to') to?: string): Promise<ProviderCostSummaryDto[]> {
    return this.adminService.getProviderCostSummaries(from ?? null, to ?? null);
  }

  @Get('billing/metrics')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Billing metrics (read-only)',
    description:
      'Account status distribution (subscription-status proxy), access-tier distribution (plan proxy), listing/AO quota usage-pressure summaries, and the total estimated cost for the period. Read-only.',
  })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'Cost-period start (ISO 8601). Defaults to start of current month.' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'Cost-period end (ISO 8601). Defaults to now.' })
  @ApiOkResponse({ description: 'Billing metrics retrieved' })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  @ApiForbiddenResponse({ description: 'User is not an admin' })
  async getBillingMetrics(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<AdminBillingMetricsDto> {
    return this.adminService.getBillingMetrics(from ?? null, to ?? null);
  }

  @Get('operations/summary')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Operations and warning summary' })
  async getOperationsSummary(): Promise<AdminOperationsSummaryDto> {
    return this.adminService.getOperationsSummary(this.queues());
  }

  @Get('queues/observations')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Queue terminal event observations' })
  @ApiQuery({ name: 'queueName', required: false, type: String })
  @ApiQuery({ name: 'event', required: false, enum: QueueEventType })
  @ApiQuery({ name: 'correlationId', required: false, type: String })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  async getQueueObservations(
    @Query('queueName') queueName?: string,
    @Query('event') event?: QueueEventType,
    @Query('correlationId') correlationId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string
  ): Promise<QueueObservationDto[]> {
    const query: QueueObservationQuery = {
      queueName,
      event,
      correlationId,
      from,
      to,
      limit: limit ? Number(limit) : undefined,
      page: page ? Number(page) : undefined,
    };
    return this.adminService.getQueueObservations(query);
  }

  @Get('queues/observations/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Single queue terminal event observation' })
  async getQueueObservation(@Param('id') id: string): Promise<QueueObservationDto | null> {
    return this.adminService.getQueueObservation(id);
  }
}
