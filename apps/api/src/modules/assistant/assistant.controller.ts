import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { AssistantErrorCode, AssistantGenerationStatus, AssistantStreamEventType } from '@repo/shared';
import type { Request, Response } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { AssistantConversationService } from './assistant-conversation.service';
import { AssistantGenerationService } from './assistant-generation.service';
import { CreateAssistantConversationDto, CreateAssistantMessageDto, MarkAssistantConversationReadDto, RequestAssistantSupportDto, RetryAssistantMessageDto, UnarchiveAssistantConversationDto, UpdateAssistantConversationDto, AssistantConversationListQueryDto, AssistantMessageListQueryDto } from './dto/assistant.dto';

interface AuthenticatedRequest extends Request { user: { sub: string; exp?: number } }
const GENERATION_HEARTBEAT_MS = 15_000;

@Controller({ path: 'assistant/conversations', version: '1' })
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(private readonly conversations: AssistantConversationService, private readonly generation: AssistantGenerationService) {}

  @Get() list(@Req() req: AuthenticatedRequest, @Query() query: AssistantConversationListQueryDto) { return this.conversations.list(req.user.sub, query.limit); }
  @Post() create(@Req() req: AuthenticatedRequest, @Body() body: CreateAssistantConversationDto) { return this.conversations.create(req.user.sub, body); }
  @Get(':id') detail(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.conversations.detail(req.user.sub, id); }
  @Get(':id/messages') history(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Query() query: AssistantMessageListQueryDto) { return this.conversations.history(req.user.sub, id, query.beforeSequence, query.limit); }
  @Patch(':id') async rename(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpdateAssistantConversationDto) { await this.conversations.rename(req.user.sub, id, body.title); return this.conversations.detail(req.user.sub, id); }
  @Post(':id/read') read(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: MarkAssistantConversationReadDto) { return this.conversations.markRead(req.user.sub, id, body.throughSequence); }
  @Post(':id/archive') archive(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.conversations.archive(req.user.sub, id); }
  @Post(':id/unarchive') unarchive(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: UnarchiveAssistantConversationDto) { return this.conversations.unarchive(req.user.sub, id, body.status); }
  @Post(':id/reopen-ai') reopenAi(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.conversations.reopenAi(req.user.sub, id); }
  @Post(':id/reopen-support') reopenSupport(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.conversations.reopenSupport(req.user.sub, id); }
  @Delete(':id') delete(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.conversations.delete(req.user.sub, id); }
  @Post(':id/restore') restore(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.conversations.restore(req.user.sub, id); }
  @Post(':id/support-request') requestSupport(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() _body: RequestAssistantSupportDto) { return this.conversations.requestSupport(req.user.sub, id); }
  @Post(':id/support-request/cancel') cancelSupport(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.conversations.cancelSupport(req.user.sub, id); }
  @Post(':id/messages') postSupportMessage(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: CreateAssistantMessageDto) { return this.conversations.postSupportMessage(req.user.sub, id, body.clientMessageId, body.content); }

  @Post(':id/messages/stream')
  @HttpCode(200)
  async stream(@Req() req: AuthenticatedRequest, @Res() res: Response, @Param('id') id: string, @Body() body: CreateAssistantMessageDto) {
    await this.generation.preflight(req.user.sub, id);
    this.openSse(res);
    await this.runGeneration(req, res, () => this.generation.generate({ userId: req.user.sub, conversationId: id, clientMessageId: body.clientMessageId, content: body.content }));
  }

  @Post(':id/messages/:userMessageId/retry-stream')
  @HttpCode(200)
  async retry(@Req() req: AuthenticatedRequest, @Res() res: Response, @Param('id') id: string, @Param('userMessageId') userMessageId: string, @Body() _body: RetryAssistantMessageDto) {
    await this.generation.preflight(req.user.sub, id);
    this.openSse(res);
    await this.runGeneration(req, res, () => this.generation.retry(req.user.sub, id, userMessageId));
  }

  private async runGeneration(req: AuthenticatedRequest, res: Response, operation: () => ReturnType<AssistantGenerationService['generate']>) {
    const heartbeat = setInterval(() => {
      if (req.user.exp && req.user.exp <= Math.floor(Date.now() / 1000)) {
        this.event(res, AssistantStreamEventType.ERROR, { code: AssistantErrorCode.AUTH_EXPIRED });
        clearInterval(heartbeat); res.end(); return;
      }
      res.write(': heartbeat\n\n');
    }, GENERATION_HEARTBEAT_MS);
    try {
      this.event(res, AssistantStreamEventType.STREAM_STARTED, {});
      const result = await operation();
      this.event(res, result.status === AssistantGenerationStatus.COMPLETED ? AssistantStreamEventType.ASSISTANT_MESSAGE_COMPLETED : AssistantStreamEventType.ASSISTANT_MESSAGE_INCOMPLETE, result);
      this.event(res, AssistantStreamEventType.STREAM_COMPLETED, { status: result.status });
    } catch {
      this.event(res, AssistantStreamEventType.ERROR, { code: AssistantErrorCode.INTERNAL_ERROR });
    } finally { clearInterval(heartbeat); if (!res.writableEnded) { res.end(); } }
  }
  private openSse(res: Response) { res.status(200); res.setHeader('Content-Type', 'text/event-stream'); res.setHeader('Cache-Control', 'no-cache, no-transform'); res.setHeader('Connection', 'keep-alive'); res.flushHeaders(); }
  private event(res: Response, type: AssistantStreamEventType, data: object) { if (!res.writableEnded) { res.write(`event: ${type}\ndata: ${JSON.stringify({ eventType: type, ...data })}\n\n`); } }
}
