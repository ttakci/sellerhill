import { Injectable, Logger } from '@nestjs/common';
import { LlmUsagePurpose, PlatformSettingKey, type LlmMessage } from '@repo/shared';

import { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { LlmService } from '../llm/llm.service';

import type { CategoryAspect } from './aspect-builder';

/**
 * Last automated attempt at a required item specific: let a model pick from
 * eBay's OWN allowed-value list.
 *
 * Deliberately a gap-filler, not a resolver. It only runs for aspects that the
 * product data, curated defaults, learned values and built-in priors all failed
 * to fill, it is capped per listing, and its answer is validated against the
 * allowed list before use — a model that invents a value would fail the publish,
 * which is the failure mode this whole subsystem exists to remove.
 *
 * Runs on the CONTENT provider group (local Ollama by default), because listing
 * traffic is thousands of calls a day. The chatbot's paid provider is separate.
 */

/** Model output that means "I cannot tell from this". */
const NO_CHOICE = 'NONE';

/** Allowed values are truncated so a 500-value colour list cannot blow the prompt. */
const MAX_PROMPT_VALUES = 40;

export interface AspectChoiceRequest {
  aspect: CategoryAspect;
  productTitle: string;
  productFeatures?: string[];
  categoryName?: string;
}

/** Pure: the exact prompt sent for one aspect. */
export function buildAspectPrompt(request: AspectChoiceRequest): LlmMessage[] {
  const values = request.aspect.values.slice(0, MAX_PROMPT_VALUES);
  const features = (request.productFeatures ?? []).slice(0, 5).join(' | ');

  return [
    {
      role: 'system',
      content:
        'You classify e-commerce products. Choose exactly one value from the provided list. ' +
        `Answer with the value verbatim and nothing else. If the product information does not support any value, answer ${NO_CHOICE}.`,
    },
    {
      role: 'user',
      content: [
        `Product: ${request.productTitle}`,
        features ? `Details: ${features}` : '',
        request.categoryName ? `Category: ${request.categoryName}` : '',
        `Attribute: ${request.aspect.name}`,
        values.length > 0 ? `Allowed values: ${values.join(' | ')}` : 'Allowed values: (free text, answer briefly)',
      ]
        .filter(Boolean)
        .join('\n'),
    },
  ];
}

/**
 * Pure: map a model reply onto an allowed value, or null.
 *
 * Small local models pad answers with reasoning, quotes and markdown, so the
 * reply is normalized and then matched against the list. Anything that is not
 * on the list is rejected — including a plausible-looking invention.
 */
export function parseAspectChoice(raw: string, aspect: CategoryAspect): string | null {
  const cleaned = raw
    // qwen-style models emit a <think> block before the answer.
    .replace(/<think>[\s\S]*?<\/think>/gi, ' ')
    .replace(/["'`*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length === 0 || new RegExp(`\\b${NO_CHOICE}\\b`, 'i').test(cleaned)) {
    return null;
  }

  if (!aspect.selectionOnly || aspect.values.length === 0) {
    // Free text: keep the first line, bounded.
    const firstLine = cleaned.split(/[.\n]/)[0].trim();
    return firstLine.length > 0 ? firstLine.slice(0, 65) : null;
  }

  const normalized = cleaned.toLowerCase();
  const exact = aspect.values.find((value) => value.toLowerCase() === normalized);
  if (exact) {
    return exact;
  }

  // The answer often arrives inside a sentence ("The department is Unisex Adult").
  const mentioned = aspect.values
    .filter((value) => value.length >= 3 && normalized.includes(value.toLowerCase()))
    .sort((a, b) => b.length - a.length);

  return mentioned[0] ?? null;
}

@Injectable()
export class AspectLlmService {
  private readonly logger = new Logger(AspectLlmService.name);

  constructor(
    private readonly platformSettings: PlatformSettingsService,
    private readonly llm: LlmService
  ) {}

  /** Checked at call time so the admin toggle stops spend without a restart. */
  async isEnabled(): Promise<boolean> {
    try {
      return await this.platformSettings.getBoolean(PlatformSettingKey.EBAY_ASPECTS_LLM_ENABLED);
    } catch {
      return false;
    }
  }

  async maxAspectsPerListing(): Promise<number> {
    try {
      return await this.platformSettings.getNumber(PlatformSettingKey.EBAY_ASPECTS_LLM_MAX_PER_LISTING);
    } catch {
      return 0;
    }
  }

  /**
   * Pick a value for one aspect. Never throws: an unavailable or slow model
   * simply means the deterministic fallback keeps the listing publishable.
   */
  async chooseValue(request: AspectChoiceRequest): Promise<string | null> {
    if (!this.llm.isAvailable()) {
      return null;
    }

    try {
      const result = await this.llm.chat(buildAspectPrompt(request), {
        purpose: LlmUsagePurpose.ASPECT,
        temperature: 0,
        maxTokens: 32,
        timeoutMs: 15_000,
      });
      const choice = parseAspectChoice(result.text, request.aspect);
      if (choice) {
        this.logger.debug(`LLM chose "${choice}" for aspect ${request.aspect.name}`);
      }
      return choice;
    } catch (error: unknown) {
      this.logger.warn(
        `LLM aspect choice failed for ${request.aspect.name}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    }
  }
}
