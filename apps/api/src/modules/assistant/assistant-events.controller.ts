import { BadRequestException, Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { AssistantCursorScope, AssistantErrorCode, AssistantInboxEventType, UserRole } from '@repo/shared';
import type { Request, Response } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { AssistantCursorError, AssistantCursorService } from './assistant-cursor.service';
import { AssistantEventService } from './assistant-event.service';
import { AssistantEventsQueryDto } from './dto/assistant.dto';

interface AuthenticatedRequest extends Request { user: { sub: string; exp?: number; role?: UserRole } }
const INBOX_HEARTBEAT_MS = 20_000;
const CURSOR_ROTATION_MS = 60_000;

@Controller({ path: 'assistant/events', version: '1' })
@UseGuards(JwtAuthGuard)
export class AssistantEventsController {
  constructor(private readonly events: AssistantEventService, private readonly cursors: AssistantCursorService) {}

  @Get()
  async stream(@Req() req: AuthenticatedRequest, @Res() res: Response, @Query() query: AssistantEventsQueryDto) {
    let after = 0n;
    try { if (query.after) { after = this.cursors.verify(query.after, req.user.sub, AssistantCursorScope.ASSISTANT_EVENTS).after; } }
    catch (error) {
      const code = error instanceof AssistantCursorError ? error.code : AssistantErrorCode.EVENT_CURSOR_INVALID;
      throw new BadRequestException({ code });
    }
    res.status(200); res.setHeader('Content-Type', 'text/event-stream'); res.setHeader('Cache-Control', 'no-cache, no-transform'); res.setHeader('Connection', 'keep-alive'); res.flushHeaders();
    let current = after;
    const sendCursor = () => this.send(res, AssistantInboxEventType.EPHEMERAL_EVENT, { cursor: this.cursors.issue(req.user.sub, current, AssistantCursorScope.ASSISTANT_EVENTS) });
    const unsubscribe = await this.events.subscribe({ userId: req.user.sub, role: req.user.role ?? UserRole.CUSTOMER, afterId: after.toString(), onEvent: (event) => { current = BigInt(event.id); this.send(res, AssistantInboxEventType.DURABLE_EVENT, { cursor: this.cursors.issue(req.user.sub, current, AssistantCursorScope.ASSISTANT_EVENTS), event }); } });
    sendCursor();
    const heartbeat = setInterval(() => {
      if (req.user.exp && req.user.exp <= Math.floor(Date.now() / 1000)) { this.send(res, AssistantInboxEventType.AUTH_EXPIRED, { code: AssistantErrorCode.AUTH_EXPIRED }); res.end(); return; }
      res.write(': heartbeat\n\n');
    }, INBOX_HEARTBEAT_MS);
    const rotation = setInterval(sendCursor, CURSOR_ROTATION_MS);
    const cleanup = () => { clearInterval(heartbeat); clearInterval(rotation); unsubscribe(); };
    req.once('close', cleanup); res.once('close', cleanup);
  }
  private send(res: Response, type: AssistantInboxEventType, data: object) { if (!res.writableEnded) { res.write(`event: ${type}\ndata: ${JSON.stringify({ eventType: type, ...data })}\n\n`); } }
}
