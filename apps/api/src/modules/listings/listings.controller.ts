import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import {
    CreateListingsRequest,
    ListingDto,
    ListingJobDto,
    ListingJobItemDto,
    ProductData
} from '@repo/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ListingQueueService } from './listing-queue.service';
import { ListingsService } from './listings.service';

@ApiTags('listings')
@ApiBearerAuth('JWT')
@Controller('listings')
@UseGuards(JwtAuthGuard)
export class ListingsController {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly listingQueueService: ListingQueueService,
  ) {}

  /**
   * Get all listings for user
   */
  @ApiOperation({ summary: 'Get all listings for current user' })
  @ApiResponse({ status: 200, description: 'List of listings', type: [Object] })
  @Get()
  async getListings(@Request() req: any): Promise<ListingDto[]> {
    const userId = req.user.sub;
    return this.listingsService.getListings(userId);
  }

  /**
   * Create bulk listings from ASINs
   */
  @ApiOperation({ summary: 'Create bulk listings from a list of ASINs' })
  @Post('bulk-create')
  async bulkCreate(
    @Request() req: any,
    @Body() body: CreateListingsRequest,
  ): Promise<ListingJobDto> {
    const userId = req.user.sub;
    return this.listingQueueService.addListingJob(userId, body);
  }

  /**
   * Get all listing jobs for user
   */
  @ApiOperation({ summary: 'Get all listing jobs for current user' })
  @Get('jobs')
  async getJobs(@Request() req: any): Promise<ListingJobDto[]> {
    const userId = req.user.sub;
    return this.listingsService.getJobs(userId);
  }

  /**
   * Get job status
   */
  @ApiOperation({ summary: 'Get status of a listing job' })
  @Get('jobs/:jobId')
  async getJobStatus(
    @Request() req: any,
    @Param('jobId') jobId: string,
  ): Promise<ListingJobDto> {
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
    @Request() req: any,
    @Param('jobId') jobId: string,
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
    return product;
  }

  @ApiOperation({ summary: 'Get a single listing by ID' })
  @ApiResponse({ status: 200, description: 'Listing details' })
  @Get(':id')
  async getListing(@Request() req: any, @Param('id') id: string): Promise<ListingDto> {
    const userId = req.user.sub;
    const listing = await this.listingsService.getListing(userId, id);
    if (!listing) {
      throw new Error('Listing not found');
    }
    return listing;
  }

  /**
   * Bulk end listings on eBay
   */
  @ApiOperation({ summary: 'Bulk end active listings on eBay' })
  @Post('bulk-end')
  async bulkEnd(
    @Request() req: any,
    @Body() body: { listingIds: string[] },
  ): Promise<{ success: boolean; count: number }> {
    const userId = req.user.sub;
    const count = await this.listingsService.endListings(userId, body.listingIds);
    return { success: true, count };
  }
}
