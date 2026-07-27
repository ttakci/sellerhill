import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AssistantRetentionCandidate {
  deleteAfter: Date | null;
  lastMessageAt: Date;
}

@Injectable()
export class AssistantRetentionService {
  constructor(private readonly config: ConfigService) {}

  deleteAfter(now = new Date()): Date {
    const days = this.boundedDays('ASSISTANT_DELETE_GRACE_DAYS', 7, 1, 30);
    return new Date(now.getTime() + days * 86_400_000);
  }

  isRestoreEligible(candidate: AssistantRetentionCandidate, now = new Date()): boolean {
    return candidate.deleteAfter !== null && candidate.deleteAfter.getTime() > now.getTime();
  }

  isInactiveRetentionEligible(candidate: AssistantRetentionCandidate, now = new Date()): boolean {
    const days = this.boundedDays('ASSISTANT_CONVERSATION_RETENTION_DAYS', 365, 30, 3650);
    return candidate.lastMessageAt.getTime() <= now.getTime() - days * 86_400_000;
  }

  private boundedDays(key: string, fallback: number, minimum: number, maximum: number): number {
    const value = Number(this.config.get<string>(key, String(fallback)));
    return Number.isFinite(value) ? Math.min(Math.max(Math.trunc(value), minimum), maximum) : fallback;
  }
}
