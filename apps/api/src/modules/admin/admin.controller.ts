// apps/api/src/modules/admin/admin.controller.ts
//
// Admin Observability & FinOps — every route is gated by JwtAuthGuard
// (authenticate) + RolesGuard (authorize) + PrivilegedSessionGuard
// (per-request session revalidation) + @Roles(UserRole.ADMIN).
//
// The controller is read-only for observability data, with TWO deliberate
// write surfaces — both platform infrastructure that has no owning customer
// module, so an operator action is the only way they ever change:
//   1. Proxy pool (POST/PATCH /admin/proxies*) — register purchased fixed ISP
//      proxies, disable burned ones. Assignment is NOT writable (ProxyService
//      owns the atomic claim).
//   2. Runtime settings (PUT/DELETE /admin/settings/:key) — operator overrides
//      for tunables that would otherwise require an env change + redeploy.
//      Secrets and connection bootstrap are excluded from the registry.
// All other admin mutations still go through the owning module's endpoint
// with its own guard chain.
//
// Endpoints (all v1, /admin/*):
//   GET    /admin/overview            — counts + usage + queue health (one call)
//   GET    /admin/usage/summaries     — usage summaries with optional filters
//   GET    /admin/queues/health       — BullMQ queue job counts
//   GET    /admin/queues/observations — terminal queue events (+ /:id)
//   GET    /admin/finops/users        — per-user cost summaries
//   GET    /admin/finops/providers    — per-provider cost summaries
//   GET    /admin/billing/metrics     — quota pressure + cost totals
//   GET    /admin/ebay/budget         — daily eBay API quota usage per resource
//   GET    /admin/listing-failures    — failed listing attempts WITH raw provider text
//   GET    /admin/operations/summary  — queue summaries + warnings
//   GET    /admin/proxies             — proxy pool listing + summary
//   POST   /admin/proxies             — register a purchased proxy
//   PATCH  /admin/proxies/:id         — status/label/expiry/cost patch
//   GET    /admin/listing-quality/summary   — how item specifics got filled
//   GET    /admin/listing-quality/defaults  — curated + learned aspect values
//   PUT    /admin/listing-quality/defaults  — curate one aspect value (3rd write surface)
//   DELETE /admin/listing-quality/defaults/:id — drop a curated value / retire a learned one
//   GET    /admin/listing-quality/categories   — learned + pinned category mappings
//   GET    /admin/users               — per-user monitoring snapshot
//   GET    /admin/settings            — runtime settings + provenance
//   PUT    /admin/settings/:key       — set an operator override
//   DELETE /admin/settings/:key       — drop the override (back to env/default)
//   POST   /admin/settings/email/test — verify SMTP settings (sends no mail)

import { InjectQueue } from '@nestjs/bullmq';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
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
  CreateProxyDto,
  PlatformSettingKey,
  QueueEventType,
  UpdatePlatformSettingDto,
  UpdateProxyDto,
  UpsertAspectDefaultDto,
  UsageEventSource,
  UsageMetric,
  UserRole,
  type AdminAspectDefaultDto,
  type AdminAspectDefaultsListDto,
  type AdminBillingMetricsDto,
  type AdminCategoryMappingDto,
  type AdminListingFailuresDto,
  type AdminListingQualitySummaryDto,
  type AdminOperationsSummaryDto,
  type AdminOverviewDto,
  type EbayCallBudgetStatusDto,
  type ListingFailureCode,
  type AdminProxyDto,
  type AdminProxyListDto,
  type AdminUsersListDto,
  type PlatformSettingsListDto,
  type ProviderCostSummaryDto,
  type QueueHealthDto,
  type UserCostSummaryDto,
  type QueueObservationDto,
  type QueueObservationQuery,
  type UsageSummaryDto,
} from '@repo/shared';
import type { Queue } from 'bullmq';

import { EbayCallBudgetService } from '../../common/ebay-budget/ebay-call-budget.service';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OperatorSurface } from '../auth/operator-surface.decorator';
import { PrivilegedSessionGuard } from '../auth/privileged-session.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { EmailService } from '../email/email.service';

import { AdminListingFailuresService } from './admin-listing-failures.service';
import { AdminListingQualityService } from './admin-listing-quality.service';
import { AdminProxiesService } from './admin-proxies.service';
import { AdminUsersService } from './admin-users.service';
import { AdminService } from './admin.service';

@ApiTags('admin')
@Controller({ path: 'admin', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard, PrivilegedSessionGuard)
@OperatorSurface()
@ApiBearerAuth()
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminProxiesService: AdminProxiesService,
    private readonly adminListingQualityService: AdminListingQualityService,
    private readonly adminUsersService: AdminUsersService,
    private readonly listingFailures: AdminListingFailuresService,
    private readonly ebayCallBudget: EbayCallBudgetService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly emailService: EmailService,
    @InjectQueue('order-sync') private readonly orderSyncQueue: Queue,
    @InjectQueue('stock-sync') private readonly stockSyncQueue: Queue,
    @InjectQueue('auto-fulfill') private readonly autoFulfillQueue: Queue,
    @InjectQueue('amazon-order-sync') private readonly amazonOrderSyncQueue: Queue,
    @InjectQueue('amazon-tracking') private readonly amazonTrackingQueue: Queue,
    @InjectQueue('amazon-verify') private readonly amazonVerifyQueue: Queue,
    @InjectQueue('listings') private readonly listingsQueue: Queue,
    @InjectQueue('keepa-refresh') private readonly keepaRefreshQueue: Queue,
    @InjectQueue('buyer-message') private readonly buyerMessageQueue: Queue,
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
      { name: 'buyer-message', queue: this.buyerMessageQueue },
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

  @Get('ebay/budget')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'eBay API call budget (read-only)',
    description:
      'Daily quota, consumption and reset time per eBay API resource. Quotas are metered PER APPLICATION, so this pool is shared by every seller — exhausting one resource stops that operation platform-wide.',
  })
  @ApiOkResponse({ description: 'Budget status retrieved' })
  async getEbayCallBudget(): Promise<EbayCallBudgetStatusDto[]> {
    return this.ebayCallBudget.status();
  }

  @Get('listing-failures')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Failed listing attempts (read-only, operator diagnostics)',
    description:
      "The only surface carrying the provider's raw error text. Sellers see the localized failure code instead, because eBay's own wording is not actionable for them.",
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'failureCode', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'ASIN or seller email prefix' })
  @ApiOkResponse({ description: 'Listing failures retrieved' })
  async getListingFailures(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('failureCode') failureCode?: ListingFailureCode,
    @Query('search') search?: string
  ): Promise<AdminListingFailuresDto> {
    return this.listingFailures.list({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      failureCode,
      search,
    });
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

  @Get('proxies')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Proxy pool listing + summary',
    description:
      'Every proxy pool row (credentials excluded) with server-derived expiry state, plus aggregate pool health and monthly cost. Read-only.',
  })
  @ApiOkResponse({ description: 'Proxy pool retrieved' })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  @ApiForbiddenResponse({ description: 'User is not an admin' })
  async getProxies(): Promise<AdminProxyListDto> {
    return this.adminProxiesService.list();
  }

  @Post('proxies')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Register a purchased proxy',
    description:
      'Adds a fixed ISP proxy to the pool. The password is encrypted at rest immediately and never returned. Users claim proxies lazily via ProxyService — assignment is not settable here.',
  })
  @ApiOkResponse({ description: 'Proxy created' })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  @ApiForbiddenResponse({ description: 'User is not an admin' })
  async createProxy(@Body() dto: CreateProxyDto): Promise<AdminProxyDto> {
    return this.adminProxiesService.create(dto);
  }

  @Patch('proxies/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update proxy operational fields',
    description:
      'Patches status (disable a burned proxy), label, expiry date, and monthly cost. Credentials and assignment are deliberately not patchable.',
  })
  @ApiOkResponse({ description: 'Proxy updated' })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  @ApiForbiddenResponse({ description: 'User is not an admin' })
  async updateProxy(@Param('id') id: string, @Body() dto: UpdateProxyDto): Promise<AdminProxyDto> {
    return this.adminProxiesService.update(id, dto);
  }

  @Get('listing-quality/summary')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Item-specifics quality summary',
    description:
      'How eBay item specifics were actually filled on recent listings: average count per listing, which resolution layer supplied them, and the categories where the broad fallback fires most (the curation worklist).',
  })
  @ApiOkResponse({ description: 'Summary returned' })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  @ApiForbiddenResponse({ description: 'User is not an admin' })
  async getListingQualitySummary(@Query('days') days?: string): Promise<AdminListingQualitySummaryDto> {
    return this.adminListingQualityService.getSummary(Number(days) || 30);
  }

  @Get('listing-quality/defaults')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Curated + learned item-specific values',
    description:
      'Values used to fill category-required item specifics. Learned rows are written after a successful publish; curated rows are operator-set and outrank them.',
  })
  @ApiOkResponse({ description: 'Defaults returned' })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  @ApiForbiddenResponse({ description: 'User is not an admin' })
  async getAspectDefaults(
    @Query('marketplaceId') marketplaceId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ): Promise<AdminAspectDefaultsListDto> {
    return this.adminListingQualityService.listAspectDefaults({
      marketplaceId,
      categoryId,
      search,
      page: Number(page) || undefined,
      limit: Number(limit) || undefined,
    });
  }

  @Put('listing-quality/defaults')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Curate an item-specific value for a category',
    description:
      'Third deliberate write surface: category-level defaults are shared across all customers, so they are operator-owned. A value the category does not accept is rejected here rather than failing every publish later.',
  })
  @ApiOkResponse({ description: 'Default stored' })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  @ApiForbiddenResponse({ description: 'User is not an admin' })
  async upsertAspectDefault(
    @Request() req: { user: { sub: string } },
    @Body() dto: UpsertAspectDefaultDto
  ): Promise<AdminAspectDefaultDto> {
    return this.adminListingQualityService.upsertAspectDefault(dto, req.user.sub);
  }

  @Delete('listing-quality/defaults/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Remove a curated value (or retire a learned one)',
    description:
      'Curated rows are deleted; learned rows are marked stale instead, because their publish history is evidence about the category.',
  })
  @ApiOkResponse({ description: 'Default removed' })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  @ApiForbiddenResponse({ description: 'User is not an admin' })
  async removeAspectDefault(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.adminListingQualityService.removeAspectDefault(id);
    return { success: true };
  }

  @Get('listing-quality/categories')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Learned and pinned eBay category mappings',
    description: 'What the resolver decided for an ASIN / Amazon category / search query, and how often it was used.',
  })
  @ApiOkResponse({ description: 'Mappings returned' })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  @ApiForbiddenResponse({ description: 'User is not an admin' })
  async getCategoryMappings(@Query('limit') limit?: string): Promise<AdminCategoryMappingDto[]> {
    return this.adminListingQualityService.listCategoryMappings(Number(limit) || undefined);
  }

  @Get('users')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Per-user monitoring snapshot',
    description:
      'One row per user: operational footprint (active listings, connected accounts, recent orders, assigned proxy) + period usage/cost attribution. Read-only.',
  })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'Usage period start (ISO 8601). Defaults to start of current month.' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'Usage period end (ISO 8601). Defaults to now.' })
  @ApiOkResponse({ description: 'User monitoring snapshot retrieved' })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  @ApiForbiddenResponse({ description: 'User is not an admin' })
  async getUsers(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<AdminUsersListDto> {
    return this.adminUsersService.getUsers(from ?? null, to ?? null);
  }

  @Get('settings')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Runtime platform settings',
    description:
      'Every operator-tunable setting with its effective value, provenance (database/env/default) and whether a restart is needed. Secret values are never returned — only whether one is configured.',
  })
  @ApiOkResponse({ description: 'Settings retrieved' })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  @ApiForbiddenResponse({ description: 'User is not an admin' })
  async getSettings(): Promise<PlatformSettingsListDto> {
    return this.platformSettings.list();
  }

  @Put('settings/:key')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Override a platform setting',
    description:
      'Writes a database override for the key. The value is validated against the registry (type, bounds, enum options) before it is stored, and the change is audit-logged.',
  })
  @ApiOkResponse({ description: 'Setting updated' })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  @ApiForbiddenResponse({ description: 'User is not an admin' })
  async updateSetting(
    @Param('key') key: string,
    @Body() dto: UpdatePlatformSettingDto,
    @Request() req: { user: { sub: string } },
  ): Promise<PlatformSettingsListDto> {
    await this.platformSettings.set(key as PlatformSettingKey, dto.value, req.user.sub);
    return this.platformSettings.list();
  }

  @Delete('settings/:key')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Reset a platform setting to its env/default value',
    description: 'Deletes the database override so the key falls back to its env var or code default.',
  })
  @ApiOkResponse({ description: 'Setting reset' })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  @ApiForbiddenResponse({ description: 'User is not an admin' })
  async resetSetting(
    @Param('key') key: string,
    @Request() req: { user: { sub: string } },
  ): Promise<PlatformSettingsListDto> {
    await this.platformSettings.reset(key as PlatformSettingKey, req.user.sub);
    return this.platformSettings.list();
  }

  @Post('settings/email/test')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Verify the current SMTP settings',
    description:
      'Opens an SMTP connection with the effective mail settings so a credential change can be confirmed before it is relied on. Sends no mail.',
  })
  @ApiOkResponse({ description: 'Verification result' })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  @ApiForbiddenResponse({ description: 'User is not an admin' })
  async testEmailSettings(): Promise<{ ok: boolean; error: string | null }> {
    return this.emailService.verifyConnection();
  }
}
