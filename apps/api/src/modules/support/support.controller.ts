import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { SupportQueueFilter, UserRole, type AuthenticatedRequest } from '@repo/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrivilegedSessionGuard } from '../auth/privileged-session.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { SupportHeartbeatDto, SupportMessageDto, SupportPresencePreferenceDto, SupportQueueQueryDto, SupportReadDto, SupportTransferDto } from './support.dto';
import { SupportService } from './support.service';

@Controller('support')
@UseGuards(JwtAuthGuard, PrivilegedSessionGuard, RolesGuard)
@Roles(UserRole.SUPPORT)
export class SupportController {
  constructor(private readonly support: SupportService) {}
  @Get('conversations') list(@Request() req: AuthenticatedRequest, @Query() query: SupportQueueQueryDto) { return this.support.list(req.user, query.filter ?? SupportQueueFilter.WAITING, query.search, query.limit); }
  @Get('conversations/:id') detail(@Request() req: AuthenticatedRequest, @Param('id') id: string) { return this.support.detail(req.user, id); }
  @Get('conversations/:id/history') history(@Request() req: AuthenticatedRequest, @Param('id') id: string) { return this.support.detail(req.user, id); }
  @Post('conversations/:id/claim') claim(@Request() req: AuthenticatedRequest, @Param('id') id: string) { return this.support.claim(req.user, id); }
  @Post('conversations/:id/release') release(@Request() req: AuthenticatedRequest, @Param('id') id: string) { return this.support.release(req.user, id); }
  @Post('conversations/:id/transfer') transfer(@Request() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: SupportTransferDto) { return this.support.transfer(req.user, id, body.kind, body.targetSupportUserId); }
  @Post('conversations/:id/reply') reply(@Request() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: SupportMessageDto) { return this.support.reply(req.user, id, body.clientMessageId, body.content); }
  @Post('conversations/:id/read') read(@Request() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: SupportReadDto) { return this.support.read(req.user, id, body.throughSequence); }
  @Post('conversations/:id/resolve') resolve(@Request() req: AuthenticatedRequest, @Param('id') id: string) { return this.support.resolve(req.user, id); }
  @Post('conversations/:id/reopen-support') reopen(@Request() req: AuthenticatedRequest, @Param('id') id: string) { return this.support.reopenSupport(req.user, id); }
  @Post('conversations/:id/return-to-ai') returnToAi(@Request() req: AuthenticatedRequest, @Param('id') id: string) { return this.support.returnToAi(req.user, id); }
  @Post('presence/preference') preference(@Request() req: AuthenticatedRequest, @Body() body: SupportPresencePreferenceDto) { return this.support.setPreference(req.user, body.availability); }
  @Post('presence/heartbeat') heartbeat(@Request() req: AuthenticatedRequest, @Body() body: SupportHeartbeatDto) { return this.support.heartbeat(req.user, body.connectionId); }
  @Get('presence/eligible-transfer-targets') eligible(@Request() req: AuthenticatedRequest) { return this.support.eligible(req.user); }
}
