import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ProductData } from '@repo/shared';

export interface ContentRewriteInput {
  product: ProductData;
  /** Pre-processed deterministic title (brand strip etc.). */
  baseTitle: string;
  /** Pre-processed template/features description HTML or text. */
  baseDescription: string;
}

/**
 * Optional free local LLM rewrites for listing title/description at **create time only**.
 *
 * Scale notes (100k+ listings):
 * - Never call on Keepa refresh / product-sync — only listing create path.
 * - One short Ollama request per new ASIN when group flag is on.
 * - Hard timeout → always fall back to baseTitle/baseDescription so the job queue never stalls.
 * - Throughput ≈ worker concurrency × tokens/s of the local model; for bulk historical rewrites
 *   run a separate offline batch (not online order path). Prefer strip-brand + templates for mass volume.
 *
 * Provider: Ollama HTTP API (default http://127.0.0.1:11434). No paid cloud key required.
 */
@Injectable()
export class ContentGenerationService {
  private readonly logger = new Logger(ContentGenerationService.name);

  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    const v = (this.configService.get<string>('CONTENT_AI_ENABLED') || 'false').toLowerCase();
    return v === 'true' || v === '1' || v === 'yes';
  }

  private baseUrl(): string {
    return (
      this.configService.get<string>('CONTENT_AI_OLLAMA_URL') ||
      this.configService.get<string>('OLLAMA_BASE_URL') ||
      'http://127.0.0.1:11434'
    ).replace(/\/$/, '');
  }

  private model(): string {
    return (
      this.configService.get<string>('CONTENT_AI_OLLAMA_MODEL') ||
      this.configService.get<string>('OLLAMA_MODEL') ||
      'llama3.2:1b'
    );
  }

  private titleTimeoutMs(): number {
    return Math.max(1000, Number(this.configService.get('CONTENT_AI_TITLE_TIMEOUT_MS') || 8000));
  }

  private descriptionTimeoutMs(): number {
    return Math.max(1000, Number(this.configService.get('CONTENT_AI_DESCRIPTION_TIMEOUT_MS') || 15000));
  }

  /**
   * Rewrite eBay title (≤80 chars). Returns baseTitle on any failure / disabled.
   */
  async rewriteTitle(input: ContentRewriteInput): Promise<string> {
    if (!this.isEnabled()) {
      return input.baseTitle;
    }

    const features = (input.product.features || []).slice(0, 6).join('; ');
    const prompt = [
      'You write eBay listing titles for dropshippers.',
      'Rules: English only. Max 80 characters. No brand name if avoidable. No quotes. No HTML. One line only.',
      'Do not invent false claims. Prefer searchable keywords from the product.',
      `ASIN: ${input.product.asin || ''}`,
      `Brand: ${input.product.brand || ''}`,
      `Category: ${input.product.category || ''}`,
      `Source title: ${input.baseTitle}`,
      features ? `Features: ${features}` : '',
      'Reply with only the title text.',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const raw = await this.ollamaGenerate(prompt, this.titleTimeoutMs(), 0.3);
      const cleaned = this.cleanTitle(raw);
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
    if (!this.isEnabled()) {
      return input.baseDescription;
    }

    const features = (input.product.features || []).slice(0, 12).join('\n- ');
    const plainBase = this.stripHtml(input.baseDescription).slice(0, 1200);
    const prompt = [
      'You write short eBay listing descriptions for dropshippers.',
      'Rules: English. 2-4 short paragraphs or bullet lines. No brand hype if avoidable. No HTML tags. No markdown fences.',
      'Do not invent warranties, certifications, or medical claims. Stay factual from the source.',
      `Source title: ${input.baseTitle}`,
      plainBase ? `Source text: ${plainBase}` : '',
      features ? `Features:\n- ${features}` : '',
      'Reply with only the description body.',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const raw = await this.ollamaGenerate(prompt, this.descriptionTimeoutMs(), 0.4);
      const cleaned = this.cleanDescription(raw);
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

  /**
   * Ollama /api/generate with AbortSignal timeout.
   * @see https://github.com/ollama/ollama/blob/main/docs/api.md
   */
  private async ollamaGenerate(prompt: string, timeoutMs: number, temperature: number): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl()}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model(),
          prompt,
          stream: false,
          options: {
            temperature,
            num_predict: 256,
          },
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Ollama HTTP ${res.status}: ${body.slice(0, 200)}`);
      }

      const data = (await res.json()) as { response?: string };
      if (!data.response || typeof data.response !== 'string') {
        throw new Error('Ollama response missing response field');
      }
      return data.response;
    } finally {
      clearTimeout(timer);
    }
  }
}
