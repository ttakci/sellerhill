import { BadRequestException, Controller, Get, Logger, Query, Redirect, Request, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    ApiBearerAuth,
    ApiForbiddenResponse,
    ApiOkResponse,
    ApiOperation,
    ApiQuery,
    ApiTags,
    ApiUnauthorizedResponse
} from '@nestjs/swagger';
import type { CreateEbayConnectUrlResponse, EbayMarketplaceId, GetEbayAccountsResponse } from '@repo/shared';

import { EmailVerifiedGuard } from '../../common/guards/email-verified.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { EbayService } from './ebay.service';

@ApiTags('ebay')
@Controller({ path: 'ebay', version: '1' })
export class EbayController {
  private readonly logger = new Logger(EbayController.name);

  constructor(
    private readonly ebayService: EbayService,
    private readonly configService: ConfigService
  ) {}

  @Get('connect-url')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get eBay OAuth consent URL',
    description: 'Generate URL for user to authorize eBay account connection (requires verified email)',
  })
  @ApiQuery({ name: 'marketplaceId', required: false, description: 'eBay marketplace identifier', example: 'EBAY_US' })
  @ApiOkResponse({ description: 'Consent URL generated successfully' })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  @ApiForbiddenResponse({ description: 'Email not verified' })
  async getConnectUrl(
    @Request() req: any,
    @Query('marketplaceId') marketplaceId?: EbayMarketplaceId
  ): Promise<CreateEbayConnectUrlResponse> {
    const userId = req.user.sub;
    return this.ebayService.createConnectUrl(userId, marketplaceId);
  }

  @Get('callback')
  @ApiOperation({
    summary: 'eBay OAuth callback',
    description: 'Handle redirect from eBay after user authorization',
  })
  @ApiQuery({ name: 'code', required: false, description: 'Authorization code from eBay' })
  @ApiQuery({ name: 'state', required: false, description: 'State parameter for CSRF protection' })
  @ApiQuery({ name: 'error', required: false, description: 'Error code if authorization failed' })
  @ApiQuery({ name: 'error_description', required: false, description: 'Error description' })
  @Redirect()
  async handleCallback(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string
  ): Promise<{ url: string }> {
    this.logger.log('Received eBay OAuth callback');

    // Check for error from eBay
    if (error) {
      this.logger.error(`eBay OAuth error: ${error} - ${errorDescription}`);
      // Redirect to frontend with error
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
      return { url: `${frontendUrl}/ebay/callback?error=${encodeURIComponent(error)}` };
    }

    // Validate required parameters
    if (!code || !state) {
      throw new BadRequestException('ebay.errors.noAuthorizationCode');
    }

    try {
      // Process the callback
      const { userId } = await this.ebayService.handleCallback(code, state);

      // Redirect to frontend success page
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
      this.logger.log(`eBay account connected successfully for user: ${userId}`);
      
      return { url: `${frontendUrl}/dashboard?ebay_connected=success` };
    } catch (err: any) {
      this.logger.error('Failed to handle eBay callback', err);
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
      return { url: `${frontendUrl}/ebay/callback?error=${encodeURIComponent(err.message || 'callback_failed')}` };
    }
  }

  @Get('accounts')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get connected eBay accounts',
    description: 'Retrieve list of eBay accounts connected by the authenticated user (requires verified email)',
  })
  @ApiOkResponse({ description: 'eBay accounts retrieved successfully' })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  @ApiForbiddenResponse({ description: 'Email not verified' })
  async getAccounts(@Request() req: any): Promise<GetEbayAccountsResponse> {
    const userId = req.user.sub;
    return this.ebayService.getAccountsByUserId(userId);
  }

  @Get('business-policies')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get eBay business policies',
    description: 'Fetch payment, shipping, and return policies from eBay',
  })
  async getBusinessPolicies(@Request() req: any) {
    const userId = req.user.sub;
    return this.ebayService.getBusinessPolicies(userId);
  }
}
