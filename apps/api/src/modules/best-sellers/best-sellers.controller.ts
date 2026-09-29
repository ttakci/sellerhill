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
import { type BestSellersPageDto } from '@repo/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { BestSellersQueryDto } from './best-sellers.dto';
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
      'by category alias and page (1–2). Pages are cached and shared across sellers; ' +
      'only a cache miss counts against the per-seller daily allowance returned in `allowance`.',
  })
  @ApiOkResponse({ description: 'List page (or a non-found outcome with `list: null`)' })
  @ApiBadRequestResponse({ description: 'Invalid query, or a marketplace that is not enabled' })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  @ApiNotFoundResponse({ description: 'Feature disabled by the operator' })
  @ApiTooManyRequestsResponse({ description: "Today's per-seller fetch allowance is spent" })
  @ApiServiceUnavailableResponse({ description: 'Scraper service unreachable' })
  async getPage(
    @Request() req: { user: { sub: string } },
    @Query() query: BestSellersQueryDto,
  ): Promise<BestSellersPageDto> {
    return this.bestSellers.getPage(req.user.sub, query);
  }
}
