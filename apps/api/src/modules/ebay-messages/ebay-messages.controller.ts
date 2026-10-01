import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  EbayConversationThreadDto,
  EbaySendMessageResultDto,
  EbayUnreadBreakdownDto,
  EbayUnreadCountDto,
  PaginatedConversationsDto,
} from '@repo/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import {
  EbayBulkConversationStatusDto,
  EbayConversationReadDto,
  EbayConversationsQueryDto,
  EbayRefreshUnreadDto,
  EbayReplyMessageDto,
  EbayThreadQueryDto,
} from './ebay-messages.dto';
import { EbayMessagesService, MESSAGING_ERRORS } from './ebay-messages.service';

/**
 * Service error keys → HTTP statuses, so the seller gets the localized reason
 * instead of a blank 500 (same split as `rethrowBillingError`). A key with no
 * mapping stays a 500 and is visible in the logs.
 */
const MESSAGING_ERROR_STATUS: Record<string, HttpStatus> = {
  [MESSAGING_ERRORS.SCOPE_MISSING]: HttpStatus.CONFLICT,
  [MESSAGING_ERRORS.REPLY_NOT_ALLOWED]: HttpStatus.CONFLICT,
  [MESSAGING_ERRORS.TOO_LONG]: HttpStatus.BAD_REQUEST,
  [MESSAGING_ERRORS.UNAVAILABLE]: HttpStatus.BAD_GATEWAY,
  [MESSAGING_ERRORS.REJECTED]: HttpStatus.BAD_REQUEST,
  [MESSAGING_ERRORS.ACCOUNT_NOT_FOUND]: HttpStatus.NOT_FOUND,
};

function rethrowMessagingError(error: unknown): never {
  const key = error instanceof Error ? error.message : '';
  const status = MESSAGING_ERROR_STATUS[key];
  if (status) {
    throw new HttpException(key, status);
  }
  throw error;
}

type AuthedRequest = { user: { sub: string } };

@ApiTags('ebay-messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'ebay/messages', version: '1' })
export class EbayMessagesController {
  constructor(private readonly messages: EbayMessagesService) {}

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread eBay conversations, total and per store' })
  async unread(@Request() req: AuthedRequest): Promise<EbayUnreadCountDto> {
    try {
      return await this.messages.unreadCount(req.user.sub);
    } catch (error: unknown) {
      rethrowMessagingError(error);
    }
  }

  @Get('unread-breakdown')
  @ApiOperation({ summary: 'One store’s unread conversations, counted from eBay and split by type' })
  async unreadBreakdown(
    @Request() req: AuthedRequest,
    @Query() q: EbayRefreshUnreadDto
  ): Promise<EbayUnreadBreakdownDto> {
    try {
      return await this.messages.unreadBreakdown(req.user.sub, q.ebayAccountId);
    } catch (error: unknown) {
      rethrowMessagingError(error);
    }
  }

  @Get('conversations')
  @ApiOperation({ summary: 'One page of a store’s conversations of one type' })
  async list(@Request() req: AuthedRequest, @Query() q: EbayConversationsQueryDto): Promise<PaginatedConversationsDto> {
    try {
      return await this.messages.listConversations(req.user.sub, q);
    } catch (error: unknown) {
      rethrowMessagingError(error);
    }
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'One conversation’s messages' })
  async thread(
    @Request() req: AuthedRequest,
    @Param('id') id: string,
    @Query() q: EbayThreadQueryDto
  ): Promise<EbayConversationThreadDto> {
    try {
      return await this.messages.getThread(req.user.sub, id, q);
    } catch (error: unknown) {
      rethrowMessagingError(error);
    }
  }

  @Post('conversations/bulk-status')
  @HttpCode(200)
  @ApiOperation({ summary: 'Archive, delete or restore up to 10 conversations' })
  async bulk(
    @Request() req: AuthedRequest,
    @Body() body: EbayBulkConversationStatusDto
  ): Promise<{ succeeded: string[]; failed: string[] }> {
    try {
      return await this.messages.bulkStatus(req.user.sub, body);
    } catch (error: unknown) {
      rethrowMessagingError(error);
    }
  }

  @Post('conversations/:id/reply')
  @HttpCode(201)
  @ApiOperation({ summary: 'Reply to a buyer conversation' })
  async reply(
    @Request() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: EbayReplyMessageDto
  ): Promise<EbaySendMessageResultDto> {
    try {
      return await this.messages.reply(req.user.sub, id, body);
    } catch (error: unknown) {
      rethrowMessagingError(error);
    }
  }

  @Post('conversations/:id/read')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark a conversation read or unread' })
  async read(
    @Request() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: EbayConversationReadDto
  ): Promise<void> {
    try {
      await this.messages.setRead(req.user.sub, id, body);
    } catch (error: unknown) {
      rethrowMessagingError(error);
    }
  }

  @Post('refresh-unread')
  @HttpCode(200)
  @ApiOperation({ summary: 'Recount one store’s unread conversations from eBay' })
  async refresh(@Request() req: AuthedRequest, @Body() body: EbayRefreshUnreadDto): Promise<{ unread: number }> {
    try {
      return { unread: await this.messages.refreshUnread(req.user.sub, body.ebayAccountId) };
    } catch (error: unknown) {
      rethrowMessagingError(error);
    }
  }
}
