import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  CreateListingsRequest,
  ListingDto,
  ListingJobDto,
  ListingJobItemDto,
  type ListingsQueryDto,
  type PaginatedListingsDto,
  ProductData,
  type UpdateListingRequest,
} from '@repo/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { ListingQueueService } from './listing-queue.service';
import { ListingsService } from './listings.service';

@ApiTags('listings')
@ApiBearerAuth('JWT')
@Controller({ path: 'listings', version: '1' })
@UseGuards(JwtAuthGuard)
export class ListingsController {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly listingQueueService: ListingQueueService
  ) {}

  /**
   * Paginated listings for current user (server-side filter/sort).
   */
  @ApiOperation({ summary: 'Get paginated listings for current user' })
  @ApiResponse({ status: 200, description: 'Paginated listings' })
  @Get()
  async getListings(
    @Request() req: { user: { sub: string } },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('stockPreset') stockPreset?: string,
    @Query('ebayAccountId') ebayAccountId?: string,
    @Query('category') category?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('priceMin') priceMin?: string,
    @Query('priceMax') priceMax?: string,
    @Query('purchasePriceMin') purchasePriceMin?: string,
    @Query('purchasePriceMax') purchasePriceMax?: string,
    @Query('estimatedProfitMin') estimatedProfitMin?: string,
    @Query('estimatedProfitMax') estimatedProfitMax?: string,
    @Query('roiMin') roiMin?: string,
    @Query('roiMax') roiMax?: string,
    @Query('profitMarginMin') profitMarginMin?: string,
    @Query('profitMarginMax') profitMarginMax?: string,
    @Query('soldCountMin') soldCountMin?: string,
    @Query('soldCountMax') soldCountMax?: string,
    @Query('watchCountMin') watchCountMin?: string,
    @Query('watchCountMax') watchCountMax?: string,
    @Query('viewCountMin') viewCountMin?: string,
    @Query('viewCountMax') viewCountMax?: string,
    @Query('quantityMin') quantityMin?: string,
    @Query('quantityMax') quantityMax?: string,
    @Query('sourceStockMin') sourceStockMin?: string,
    @Query('sourceStockMax') sourceStockMax?: string,
    @Query('soldFrom') soldFrom?: string,
    @Query('soldTo') soldTo?: string
  ): Promise<PaginatedListingsDto> {
    const num = (v?: string): number | undefined =>
      v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : undefined;

    const query: ListingsQueryDto = {
      page: num(page),
      limit: num(limit),
      search,
      status,
      stockPreset,
      ebayAccountId,
      category,
      sortBy,
      sortOrder,
      priceMin: num(priceMin),
      priceMax: num(priceMax),
      purchasePriceMin: num(purchasePriceMin),
      purchasePriceMax: num(purchasePriceMax),
      estimatedProfitMin: num(estimatedProfitMin),
      estimatedProfitMax: num(estimatedProfitMax),
      roiMin: num(roiMin),
      roiMax: num(roiMax),
      profitMarginMin: num(profitMarginMin),
      profitMarginMax: num(profitMarginMax),
      soldCountMin: num(soldCountMin),
      soldCountMax: num(soldCountMax),
      watchCountMin: num(watchCountMin),
      watchCountMax: num(watchCountMax),
      viewCountMin: num(viewCountMin),
      viewCountMax: num(viewCountMax),
      quantityMin: num(quantityMin),
      quantityMax: num(quantityMax),
      sourceStockMin: num(sourceStockMin),
      sourceStockMax: num(sourceStockMax),
      soldFrom,
      soldTo,
    };

    return this.listingsService.getListings(req.user.sub, query);
  }

  /**
   * CSV export (same filters as list; up to 5000 rows)
   */
  @ApiOperation({ summary: 'Export listings as CSV (server-side filters)' })
  @ApiProduces('text/csv')
  @ApiResponse({ status: 200, description: 'CSV file body' })
  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="listings-export.csv"')
  async exportListings(
    @Request() req: { user: { sub: string } },
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('stockPreset') stockPreset?: string,
    @Query('ebayAccountId') ebayAccountId?: string,
    @Query('category') category?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('priceMin') priceMin?: string,
    @Query('priceMax') priceMax?: string,
    @Query('purchasePriceMin') purchasePriceMin?: string,
    @Query('purchasePriceMax') purchasePriceMax?: string,
    @Query('estimatedProfitMin') estimatedProfitMin?: string,
    @Query('estimatedProfitMax') estimatedProfitMax?: string,
    @Query('roiMin') roiMin?: string,
    @Query('roiMax') roiMax?: string,
    @Query('profitMarginMin') profitMarginMin?: string,
    @Query('profitMarginMax') profitMarginMax?: string,
    @Query('soldCountMin') soldCountMin?: string,
    @Query('soldCountMax') soldCountMax?: string,
    @Query('watchCountMin') watchCountMin?: string,
    @Query('watchCountMax') watchCountMax?: string,
    @Query('viewCountMin') viewCountMin?: string,
    @Query('viewCountMax') viewCountMax?: string,
    @Query('quantityMin') quantityMin?: string,
    @Query('quantityMax') quantityMax?: string,
    @Query('sourceStockMin') sourceStockMin?: string,
    @Query('sourceStockMax') sourceStockMax?: string
  ): Promise<string> {
    const num = (v?: string): number | undefined =>
      v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : undefined;

    const query: ListingsQueryDto = {
      search,
      status,
      stockPreset,
      ebayAccountId,
      category,
      sortBy,
      sortOrder,
      priceMin: num(priceMin),
      priceMax: num(priceMax),
      purchasePriceMin: num(purchasePriceMin),
      purchasePriceMax: num(purchasePriceMax),
      estimatedProfitMin: num(estimatedProfitMin),
      estimatedProfitMax: num(estimatedProfitMax),
      roiMin: num(roiMin),
      roiMax: num(roiMax),
      profitMarginMin: num(profitMarginMin),
      profitMarginMax: num(profitMarginMax),
      soldCountMin: num(soldCountMin),
      soldCountMax: num(soldCountMax),
      watchCountMin: num(watchCountMin),
      watchCountMax: num(watchCountMax),
      viewCountMin: num(viewCountMin),
      viewCountMax: num(viewCountMax),
      quantityMin: num(quantityMin),
      quantityMax: num(quantityMax),
      sourceStockMin: num(sourceStockMin),
      sourceStockMax: num(sourceStockMax),
    };

    return this.listingsService.exportListingsCsv(req.user.sub, query);
  }

  /**
   * Create bulk listings from ASINs
   */
  @ApiOperation({ summary: 'Create bulk listings from a list of ASINs' })
  @Post('bulk-create')
  async bulkCreate(
    @Request() req: { user: { sub: string } },
    @Body() body: CreateListingsRequest
  ): Promise<ListingJobDto> {
    const userId = req.user.sub;
    return this.listingQueueService.addListingJob(userId, body);
  }

  /**
   * Get all listing jobs for user
   */
  @ApiOperation({ summary: 'Get all listing jobs for current user' })
  @Get('jobs')
  async getJobs(@Request() req: { user: { sub: string } }): Promise<ListingJobDto[]> {
    const userId = req.user.sub;
    return this.listingsService.getJobs(userId);
  }

  /**
   * Get all products for user (from their listings)
   */
  @ApiOperation({ summary: 'Get all unique products from user listings' })
  @Get('products')
  async getProducts(@Request() req: { user: { sub: string } }): Promise<ProductData[]> {
    const userId = req.user.sub;
    return this.listingsService.getUserProducts(userId);
  }

  /**
   * Get job status
   */
  @ApiOperation({ summary: 'Get status of a listing job' })
  @Get('jobs/:jobId')
  async getJobStatus(@Request() req: { user: { sub: string } }, @Param('jobId') jobId: string): Promise<ListingJobDto> {
    const userId = req.user.sub;
    const status = await this.listingsService.getJobStatus(userId, jobId);
    if (!status) {
      throw new Error('Job not found');
    }
    return status;
  }

  /**
   * Get job items
   */
  @ApiOperation({ summary: 'Get individual items of a listing job' })
  @Get('jobs/:jobId/items')
  async getJobItems(
    @Request() req: { user: { sub: string } },
    @Param('jobId') jobId: string
  ): Promise<ListingJobItemDto[]> {
    const userId = req.user.sub;
    return this.listingsService.getJobItems(userId, jobId);
  }

  /**
   * Get cached product info
   */
  @ApiOperation({ summary: 'Get cached product data by ASIN' })
  @Get('products/:asin')
  async getProduct(@Param('asin') asin: string): Promise<ProductData> {
    const product = await this.listingsService.getProductByAsin(asin);
    if (!product) {
      throw new Error('Product not found');
    }
    return product.data;
  }

  @ApiOperation({ summary: 'Get a single listing by ID' })
  @ApiResponse({ status: 200, description: 'Listing details' })
  @Get(':id')
  async getListing(@Request() req: { user: { sub: string } }, @Param('id') id: string): Promise<ListingDto> {
    const userId = req.user.sub;
    const listing = await this.listingsService.getListing(userId, id);
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    return listing;
  }

  @ApiOperation({ summary: 'Update listing customizations (title, strategy group, policies)' })
  @ApiResponse({ status: 200, description: 'Updated listing' })
  @Patch(':id')
  async updateListing(
    @Request() req: { user: { sub: string } },
    @Param('id') id: string,
    @Body() body: UpdateListingRequest
  ): Promise<ListingDto> {
    return this.listingsService.updateListing(req.user.sub, id, body);
  }

  /**
   * Bulk end listings on eBay
   */
  @ApiOperation({ summary: 'Bulk end active listings on eBay' })
  @Post('bulk-end')
  async bulkEnd(
    @Request() req: { user: { sub: string } },
    @Body() body: { listingIds: string[] }
  ): Promise<{ success: boolean; count: number }> {
    const userId = req.user.sub;
    const count = await this.listingsService.endListings(userId, body.listingIds);
    return { success: true, count };
  }

  /**
   * Bulk delete listings
   */
  @ApiOperation({ summary: 'Bulk delete listings (ends them on eBay first)' })
  @Post('bulk-delete')
  async bulkDelete(
    @Request() req: { user: { sub: string } },
    @Body() body: { listingIds: string[] }
  ): Promise<{ success: boolean; count: number }> {
    const userId = req.user.sub;
    const count = await this.listingsService.deleteListings(userId, body.listingIds);
    return { success: true, count };
  }

  /**
   * Bulk publish draft listings to eBay
   */
  @ApiOperation({ summary: 'Bulk publish draft listings to eBay' })
  @Post('bulk-publish')
  async bulkPublish(
    @Request() req: { user: { sub: string } },
    @Body() body: { listingIds: string[] }
  ): Promise<{ success: boolean; count: number }> {
    const userId = req.user.sub;
    const count = await this.listingsService.publishListings(userId, body.listingIds);
    return { success: true, count };
  }

  /**
   * Publish a single draft listing to eBay
   */
  @ApiOperation({ summary: 'Publish a draft listing to eBay' })
  @Post(':id/publish')
  async publishListing(
    @Request() req: { user: { sub: string } },
    @Param('id') id: string
  ): Promise<ListingDto> {
    return this.listingsService.publishListing(req.user.sub, id);
  }
}
