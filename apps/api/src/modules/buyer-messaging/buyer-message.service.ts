// apps/api/src/modules/buyer-messaging/buyer-message.service.ts
import { Injectable } from '@nestjs/common';
import {
  BuyerMessageEventType, BuyerMessageTemplateKind, SYSTEM_BUYER_MESSAGE_TEMPLATES,
} from '@repo/shared';

import { StoreSettingsService } from '../store-settings/store-settings.service';

import { resolveEventConfig, templateVersionHash } from './buyer-message-helpers';
import { BuyerMessageTemplateRepository } from './buyer-message-template.repository';

export interface ResolvedTemplate {
  body: string;
  kind: BuyerMessageTemplateKind;
  ref: string;
  versionHash: string;
}

@Injectable()
export class BuyerMessageService {
  constructor(
    private readonly settings: StoreSettingsService,
    private readonly templates: BuyerMessageTemplateRepository,
  ) {}

  /** Resolve the effective template for an event, or null if disabled/unconfigured. */
  async resolveTemplate(
    userId: string,
    storeId: string | null,
    event: BuyerMessageEventType,
  ): Promise<ResolvedTemplate | null> {
    const settings = await this.settings.getResolvedSettings(userId, storeId);
    const ev = resolveEventConfig(settings.buyerMessaging ?? null, event);
    if (!ev) {
      return null;
    }

    if (ev.template.kind === BuyerMessageTemplateKind.SYSTEM) {
      const sys = SYSTEM_BUYER_MESSAGE_TEMPLATES[event];
      const body = sys?.body ?? '';
      return { body, kind: BuyerMessageTemplateKind.SYSTEM, ref: ev.template.id, versionHash: templateVersionHash(body) };
    }
    // custom
    const custom = await this.templates.get(userId, ev.template.id);
    if (!custom) {
      return null;
    }
    return {
      body: custom.body,
      kind: BuyerMessageTemplateKind.CUSTOM,
      ref: custom.id,
      versionHash: templateVersionHash(custom.body),
    };
  }

  /** feedback_request delay (days), with config fallback. */
  feedbackDelayDays(settings: { buyerMessaging?: { events?: Partial<Record<BuyerMessageEventType, { delayDays?: number }>> } } | null | undefined, fallback: number): number {
    const d = settings?.buyerMessaging?.events?.[BuyerMessageEventType.FEEDBACK_REQUEST]?.delayDays;
    return typeof d === 'number' && d >= 0 ? d : fallback;
  }
}
