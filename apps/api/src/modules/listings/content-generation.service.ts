import { Injectable, Logger } from '@nestjs/common';
import { LlmUsagePurpose, PlatformSettingKey, type LlmMessage, type ProductData } from '@repo/shared';

import { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { LlmService } from '../llm/llm.service';

export interface ContentRewriteInput {
  product: ProductData;
  /** Pre-processed deterministic title (brand strip etc.). */
  baseTitle: string;
  /** Pre-processed template/features description HTML or text. */
  baseDescription: string;
}

/**
 * Optional LLM rewrites for listing title/description at **create time only**.
 *
 * Scale notes (100k+ listings):
 * - Never call on Keepa refresh / product-sync — only the listing-create path.
 * - One short Chat Completions call per new ASIN when a group flag is on.
 * - Hard timeout → always fall back to baseTitle/baseDescription so the job queue never stalls.
 * - Throughput ≈ worker concurrency × provider tokens/s. For bulk historical rewrites
 *   run a separate offline batch (not online order path). Prefer strip-brand + templates for mass volume.
 *
 * Provider: OpenAI-compatible Chat Completions via `LlmService` (Task 4 of the B-spec
 * LLM infra). Provider URL/model/key are env-only on `LlmService` — this service only
 * supplies prompts + cleanup. Master toggle: the `llm.contentEnabled` platform
 * setting (admin panel), falling back to the `LLM_CONTENT_ENABLED` env var.
 */
@Injectable()
export class ContentGenerationService {
  private readonly logger = new Logger(ContentGenerationService.name);

  constructor(
    private readonly platformSettings: PlatformSettingsService,
    private readonly llm: LlmService
  ) {}

  /**
   * Master toggle, resolved at call time from platform settings so an
   * operator can stop LLM spend from the admin panel without a restart.
   */
  async isEnabled(): Promise<boolean> {
    return this.platformSettings.getBoolean(PlatformSettingKey.LLM_CONTENT_ENABLED);
  }

  /**
   * Rewrite eBay title (≤80 chars). Returns baseTitle on any failure / disabled.
   */
  async rewriteTitle(input: ContentRewriteInput): Promise<string> {
    if (!(await this.isEnabled())) {
      return input.baseTitle;
    }

    const features = (input.product.features || []).slice(0, 6).join('; ');
    const messages: LlmMessage[] = [
      {
        role: 'system',
        content: [
          'You write eBay listing titles for dropshippers.',
          'Rules: English only. Max 80 characters. No brand name if avoidable. No quotes. No HTML. One line only.',
          'Do not invent false claims. Prefer searchable keywords from the product.',
          'Reply with only the title text.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `ASIN: ${input.product.asin || ''}`,
          `Brand: ${input.product.brand || ''}`,
          `Category: ${input.product.category || ''}`,
          `Source title: ${input.baseTitle}`,
          features ? `Features: ${features}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ];

    try {
      const { text } = await this.llm.chat(messages, {
        purpose: LlmUsagePurpose.CONTENT,
        temperature: 0.3,
        maxTokens: 256,
        timeoutMs: 60_000,
      });
      const cleaned = this.cleanTitle(text);
      if (cleaned.length >= 8) {
        this.logger.debug(`AI title ok (${cleaned.length} chars) for ${input.product.asin}`);
        return cleaned;
      }
      this.logger.warn(`AI title rejected (too short); using base for ${input.product.asin}`);
    } catch (err) {
      this.logger.warn(
        `AI title skipped for ${input.product.asin}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    return input.baseTitle;
  }

  /**
   * Rewrite listing description (plain text → light HTML paragraphs). Falls back to baseDescription.
   */
  async rewriteDescription(input: ContentRewriteInput): Promise<string> {
    if (!(await this.isEnabled())) {
      return input.baseDescription;
    }

    const features = (input.product.features || []).slice(0, 12).join('\n- ');
    const plainBase = this.stripHtml(input.baseDescription).slice(0, 1200);
    const messages: LlmMessage[] = [
      {
        role: 'system',
        content: [
          'You write short eBay listing descriptions for dropshippers.',
          'Rules: English. 2-4 short paragraphs or bullet lines. No brand hype if avoidable. No HTML tags. No markdown fences.',
          'Do not invent warranties, certifications, or medical claims. Stay factual from the source.',
          'Reply with only the description body.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `Source title: ${input.baseTitle}`,
          plainBase ? `Source text: ${plainBase}` : '',
          features ? `Features:\n- ${features}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ];

    try {
      const { text } = await this.llm.chat(messages, {
        purpose: LlmUsagePurpose.CONTENT,
        temperature: 0.4,
        maxTokens: 512,
        timeoutMs: 60_000,
      });
      const cleaned = this.cleanDescription(text);
      if (cleaned.length >= 40) {
        this.logger.debug(`AI description ok (${cleaned.length} chars) for ${input.product.asin}`);
        return cleaned;
      }
      this.logger.warn(`AI description rejected (too short); using base for ${input.product.asin}`);
    } catch (err) {
      this.logger.warn(
        `AI description skipped for ${input.product.asin}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    return input.baseDescription;
  }

  private cleanTitle(raw: string): string {
    let t = raw
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\n/g, ' ')
      .trim();
    // Drop common model chatter prefixes
    t = t.replace(/^(title|ebay title)\s*:\s*/i, '');
    if (t.length > 80) {
      t = t.slice(0, 80).trim();
    }
    return t;
  }

  private cleanDescription(raw: string): string {
    let d = raw.trim();
    d = d.replace(/^```[\w]*\n?|\n?```$/g, '').trim();
    // Convert plain paragraphs to simple HTML for eBay listing body
    const paragraphs = d
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (paragraphs.length === 0) {
      return '';
    }
    // Bullet lines starting with - or *
    if (paragraphs.every((p) => /^[-*•]/.test(p) || p.includes('\n-'))) {
      const lines = d
        .split('\n')
        .map((l) => l.replace(/^[-*•]\s*/, '').trim())
        .filter(Boolean);
      return `<ul><li>${lines.map((l) => this.escapeHtml(l)).join('</li><li>')}</li></ul>`;
    }
    return paragraphs.map((p) => `<p>${this.escapeHtml(p.replace(/\n/g, ' '))}</p>`).join('');
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
