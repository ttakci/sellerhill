import { Injectable, Logger } from '@nestjs/common';
import {
  EBAY_TITLE_MAX_LENGTH,
  LlmUsagePurpose,
  PlatformSettingKey,
  type LlmMessage,
  type ProductData,
} from '@repo/shared';

import { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { LlmService } from '../llm/llm.service';

import {
  ensureBrandPrefix,
  expandTitleWithSourceKeywords,
  isTitleRewriteAcceptable,
  stripBrandFromTitle,
  truncateTitleAtWordBoundary,
} from './listing-title';

export interface ContentRewriteInput {
  /** Seller asked for the brand to be removed; the model must not put it back. */
  stripBrand?: boolean;
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
/** Shorter than this, the model did not answer — it emitted noise. */
const MIN_AI_TITLE_LENGTH = 8;

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
    // The FULL Amazon title, not `baseTitle` — that one is already brand-stripped
    // and cut to 80 characters, so the model would never see the keywords worth
    // keeping ("34g x 4ea", "Korean Skin Care") and just echoed its input back.
    const sourceTitle = (input.product.title || '').trim() || input.baseTitle;
    const messages: LlmMessage[] = [
      {
        role: 'system',
        content: [
          'You write eBay listing titles for dropshippers.',
          // eBay ranks on the title, so unused characters are lost search
          // surface. Models default to "concise" and throw half of it away.
          'The source title is usually far longer than 80 characters: compress it, do not summarise it.',
          'Use 65-80 characters. Never go under 60 unless the source is shorter.',
          'Keep every distinguishing search term from the source: model numbers, sizes, counts, pack quantities, colours, product line names.',
          input.stripBrand
            ? 'Do NOT include the brand name anywhere in the title.'
            : 'Keep the brand name if the source has one.',
          'English only. No quotes. No HTML. One line only.',
          'Do not invent false claims. Reply with only the title text.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `ASIN: ${input.product.asin || ''}`,
          `Brand: ${input.product.brand || ''}`,
          `Category: ${input.product.category || ''}`,
          `Source title: ${sourceTitle}`,
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
      // The model can re-introduce a brand the seller asked us to remove, so the
      // same deterministic rule is applied to its output.
      const stripped =
        input.stripBrand && input.product.brand
          ? stripBrandFromTitle(this.cleanTitle(text), input.product.brand)
          : this.cleanTitle(text);
      // Judge the model's OWN answer first: packing can pad anything up to the
      // threshold, so a two-character reply would otherwise sail through.
      if (stripped.length < MIN_AI_TITLE_LENGTH) {
        this.logger.warn(`AI title rejected (model answered ${stripped.length} chars) for ${input.product.asin}`);
        return input.baseTitle;
      }

      // Brand goes first when the seller keeps it; otherwise the packer would
      // append it at the very end of the title.
      const branded = input.stripBrand
        ? stripped
        : ensureBrandPrefix(stripped, input.product.brand, EBAY_TITLE_MAX_LENGTH);

      // The model picks what matters; code fills the rest of eBay's 80-character
      // budget with source keywords it left on the floor.
      const expanded = expandTitleWithSourceKeywords(
        branded,
        sourceTitle,
        EBAY_TITLE_MAX_LENGTH,
        input.stripBrand ? input.product.brand : undefined
      );
      const cleaned = truncateTitleAtWordBoundary(expanded, EBAY_TITLE_MAX_LENGTH);

      // Judged against the full source: that is where the character budget and
      // the identifier tokens (sizes, counts, model numbers) actually live.
      if (isTitleRewriteAcceptable(cleaned, sourceTitle)) {
        this.logger.debug(`AI title ok (${cleaned.length} chars) for ${input.product.asin}`);
        return cleaned;
      }
      this.logger.warn(
        `AI title rejected (${cleaned.length} chars, source ${sourceTitle.length}; ` +
          `too short or dropped every identifier) — using base for ${input.product.asin}`
      );
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
    // Full Amazon title for context — the eBay title is already compressed.
    const sourceTitle = (input.product.title || '').trim() || input.baseTitle;
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
          `Source title: ${sourceTitle}`,
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
    let t = this.stripReasoning(raw)
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
    let d = this.stripReasoning(raw).trim();
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

  /**
   * Drop the reasoning block that reasoning-capable local models emit before
   * the answer (qwen3 and friends open with a <think> section). Without this
   * the "title" became the first 80 characters of the model thinking out loud.
   *
   * An unclosed block means the model hit its token limit mid-thought, so there
   * is no answer to salvage: everything is dropped and the caller's validation
   * falls back to the deterministic title/description.
   */
  private stripReasoning(raw: string): string {
    return raw
      .replace(/<think>[\s\S]*?<\/think>/gi, ' ')
      .replace(/<think>[\s\S]*$/i, ' ')
      .trim();
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
