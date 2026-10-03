import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { type BestSellersCategoriesDto, type BestSellersPageDto } from '@repo/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { BestSellersCategoriesQueryDto, BestSellersQueryDto } from './best-sellers.dto';
import { BestSellersService } from './best-sellers.service';

/**
 * Seller-facing Amazon Best Sellers browsing.
 *
 * A customer surface, so it is deliberately NOT marked as an operator surface
 * — staff accounts are refused here by `JwtAuthGuard`, which is the correct
 * default (and `account-scope.guard.spec.ts` asserts the marker stays absent). Refusals
 * carry a `BestSellersErrorKey` i18n key as their `message`; the service maps
 * them to 400 / 404 / 429 / 503 itself.
 */
@ApiTags('best-sellers')
@Controller({ path: 'best-sellers', version: '1' })
export class BestSellersController {
  constructor(private readonly bestSellers: BestSellersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'One page of an Amazon Best Sellers list',
    description:
      'Best Sellers / New Releases / Movers & Shakers / Most Wished For / Most Gifted, ' +
      'by category alias and page (1–2). Pages are cached and shared across sellers. ' +
      'Every product shown counts against the plan\'s Best Sellers product allowance for the ' +
      'billing period (`allowance`: used / limit / remaining, -1 = unmetered); the same page ' +
      'reopened on the same UTC day is not counted twice. When the allowance runs out the page ' +
      'is still returned with `list.items` truncated server-side and `lockedCount` rows to render locked.',
  })
  @ApiOkResponse({ description: 'List page (or a non-found outcome with `list: null`)' })
  @ApiBadRequestResponse({ description: 'Invalid query, or a marketplace that is not enabled' })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  @ApiNotFoundResponse({ description: 'Feature disabled by the operator' })
  @ApiTooManyRequestsResponse({
    description:
      'Hidden anti-abuse cap: this seller triggered too many LIVE fetches (cache misses) today. ' +
      'Not the product allowance — that never refuses, it locks rows.',
  })
  @ApiServiceUnavailableResponse({ description: 'Scraper service unreachable' })
  async getPage(
    @Request() req: { user: { sub: string } },
    @Query() query: BestSellersQueryDto,
  ): Promise<BestSellersPageDto> {
    return this.bestSellers.getPage(req.user.sub, query);
  }

  @Get('categories')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'The category tree beside one Amazon Best Sellers node, without products',
    description:
      'The sidebar of one node (`category`; omitted = all departments): its chain, itself and its children, ' +
      'each with its nesting `level`. Read from a week-long shared tree cache, else the list cache, else one ' +
      'live fetch. Shows no product, so it is NOT counted against the Best Sellers product allowance; a cache ' +
      'miss still counts against the hidden daily fetch cap. `categories` is empty unless `outcome` is `found`.',
  })
  @ApiOkResponse({ description: 'Department list (empty on a non-found outcome)' })
  @ApiBadRequestResponse({ description: 'Invalid query, or a marketplace that is not enabled' })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  @ApiNotFoundResponse({ description: 'Feature disabled by the operator' })
  @ApiTooManyRequestsResponse({ description: 'Hidden anti-abuse cap on live fetches (cache misses) reached today' })
  @ApiServiceUnavailableResponse({ description: 'Scraper service unreachable' })
  async getCategories(
    @Request() req: { user: { sub: string } },
    @Query() query: BestSellersCategoriesQueryDto,
  ): Promise<BestSellersCategoriesDto> {
    return this.bestSellers.getCategories(req.user.sub, query);
  }
}
