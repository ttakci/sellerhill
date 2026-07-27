import { randomUUID } from 'crypto';

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { AssistantEventService } from './assistant-event.service';
import { AssistantOutboxRepository } from './repositories/assistant-outbox.repository';

const SWEEP_INTERVAL_MS = 1000;
const LEASE_SECONDS = 30;
const MAX_ATTEMPTS = 10;

@Injectable()
export class AssistantOutboxScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly ownerId = randomUUID();
  private readonly logger = new Logger(AssistantOutboxScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  constructor(private readonly outbox: AssistantOutboxRepository, private readonly events: AssistantEventService) {}

  async onModuleInit(): Promise<void> {
    await this.events.initialize();
    this.timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
    this.timer.unref?.();
    await this.sweep();
  }
  onModuleDestroy(): void { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
  async sweep(): Promise<void> {
    const rows = await this.outbox.lease(this.ownerId, 100, LEASE_SECONDS);
    for (const row of rows) {
      try { await this.events.publish(row.id); await this.outbox.markDispatched(this.ownerId, row.id); }
      catch (error) {
        this.logger.warn(`Outbox dispatch failed for ${row.id}`);
        await this.outbox.reschedule(this.ownerId, row.id, error instanceof Error ? error.name : 'unknown', MAX_ATTEMPTS);
      }
    }
  }
}
