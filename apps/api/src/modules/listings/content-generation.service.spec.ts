// apps/api/src/modules/listings/content-generation.service.spec.ts
import type { ProductData } from '@repo/shared';

import type { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { LlmTimeoutError } from '../llm/llm.errors';
import type { LlmService } from '../llm/llm.service';

import { ContentGenerationService } from './content-generation.service';

const product = {
  asin: 'B00TEST',
  brand: 'Acme',
  category: 'Home',
  features: ['Fast', 'Quiet'],
  title: 'Acme Widget',
} as unknown as ProductData;

/** Stub platform settings whose LLM_CONTENT_ENABLED toggle is fixed. */
function cfg(enabled: boolean): PlatformSettingsService {
  return {
    getBoolean: () => Promise.resolve(enabled),
  } as unknown as PlatformSettingsService;
}

describe('ContentGenerationService', () => {
  it('returns base when disabled', async () => {
    const chat = jest.fn();
    const llm = { chat } as unknown as LlmService;
    const svc = new ContentGenerationService(cfg(false), llm);
    const t = await svc.rewriteTitle({
      product,
      baseTitle: 'Base Title Here',
      baseDescription: 'desc',
    });
    expect(t).toBe('Base Title Here');
    expect(chat).not.toHaveBeenCalled();
  });

  it('drops the reasoning block local models emit before the answer', async () => {
    // qwen3 (the default local model) opens with a <think> section; without
    // stripping it the "title" was the model thinking out loud, truncated at 80.
    const chat = jest.fn().mockResolvedValue({
      text: '<think>The user wants a short eBay title, so I should…</think>Acme Widget Pro 12-Pack',
      model: 'qwen3:1.7b',
    });
    const llm = { chat } as unknown as LlmService;
    const svc = new ContentGenerationService(cfg(true), llm);

    const title = await svc.rewriteTitle({ product, baseTitle: 'Base Title Here', baseDescription: 'desc' });

    expect(title).toBe('Acme Widget Pro 12-Pack');
  });

  it('falls back when the model never finished thinking', async () => {
    // Unclosed <think> = token limit hit mid-thought; there is no answer.
    const chat = jest.fn().mockResolvedValue({ text: '<think>Let me consider the brand and', model: 'qwen3:1.7b' });
    const llm = { chat } as unknown as LlmService;
    const svc = new ContentGenerationService(cfg(true), llm);

    const title = await svc.rewriteTitle({ product, baseTitle: 'Base Title Here', baseDescription: 'desc' });

    expect(title).toBe('Base Title Here');
  });

  it('repairs a rewrite that shrank the title and dropped the model number', async () => {
    // The live regression was 65 chars -> 36, losing "1400B". Rather than throw
    // the rewrite away, the packer puts the missing search terms back and keeps
    // what the model added ("48oz").
    const chat = jest.fn().mockResolvedValue({ text: 'BISSELL Portable Carpet Cleaner 48oz', model: 'm' });
    const llm = { chat } as unknown as LlmService;
    const svc = new ContentGenerationService(cfg(true), llm);

    const base = 'BISSELL Little Green Multi-Purpose Portable Carpet Cleaner, 1400B';
    const title = await svc.rewriteTitle({
      product: { ...product, title: base } as unknown as ProductData,
      baseTitle: base,
      baseDescription: 'desc',
    });

    expect(title).toMatch(/1400B/);
    expect(title).toMatch(/48oz/);
    expect(title).toMatch(/Little Green/);
    expect(title.length).toBeGreaterThan(60);
    expect(title.length).toBeLessThanOrEqual(80);
  });

  it('does not let the model put back a brand the seller removed', async () => {
    const chat = jest.fn().mockResolvedValue({
      text: 'Acme Widget Pro Multi Purpose Home Tool Set 12 Piece 3in Bits',
      model: 'm',
    });
    const llm = { chat } as unknown as LlmService;
    const svc = new ContentGenerationService(cfg(true), llm);

    const title = await svc.rewriteTitle({
      product,
      baseTitle: 'Widget Pro Multi Purpose Home Tool Set 12 Piece 3in Bits',
      baseDescription: 'desc',
      stripBrand: true,
    });

    expect(title).not.toMatch(/Acme/i);
  });

  it('sends the model the FULL Amazon title, not the already-truncated eBay one', async () => {
    // The live regression: the model only ever saw the 80-char, brand-stripped
    // title, so "34g x 4ea" and "Korean Skin Care" were already gone and it
    // simply echoed its input back.
    const chat = jest.fn().mockResolvedValue({ text: 'Bio-Collagen Hydrogel Face Mask Korean Skin Care 34g x 4ea Pack', model: 'm' });
    const llm = { chat } as unknown as LlmService;
    const svc = new ContentGenerationService(cfg(true), llm);

    const fullTitle =
      'BIODANCE Bio-Collagen Real Deep Mask, Hydrating Overnight Hydrogel Face Mask, ' +
      'Pore Minimizing, Elasticity, Korean Skin Care | 1.19oz(34g) x 4ea';

    await svc.rewriteTitle({
      product: { ...product, title: fullTitle } as unknown as ProductData,
      baseTitle: 'Bio-Collagen Real Deep Mask, Hydrating Overnight Hydrogel Face Mask, Pore',
      baseDescription: 'desc',
    });

    const calls = chat.mock.calls as unknown as Array<[Array<{ content: string }>]>;
    const userMessage = calls[0][0][1].content;
    expect(userMessage).toContain('1.19oz(34g) x 4ea');
    expect(userMessage).toContain('Korean Skin Care');
  });

  it('returns base on LlmError', async () => {
    const chat = jest.fn().mockRejectedValue(new LlmTimeoutError());
    const llm = { chat } as unknown as LlmService;
    const svc = new ContentGenerationService(cfg(true), llm);
    const t = await svc.rewriteTitle({
      product,
      baseTitle: 'Base Title Here',
      baseDescription: 'desc',
    });
    expect(t).toBe('Base Title Here');
  });

  it('returns cleaned title on success', async () => {
    const chat = jest.fn().mockResolvedValue({ text: 'Great Widget Deal', model: 'm' });
    const llm = { chat } as unknown as LlmService;
    const svc = new ContentGenerationService(cfg(true), llm);
    const t = await svc.rewriteTitle({
      product,
      baseTitle: 'Base Title Here',
      baseDescription: 'desc',
    });
    // The brand leads (eBay buyers scan left to right) and packing may append
    // source keywords, so assert on content rather than an exact string.
    expect(t).toContain('Great Widget Deal');
    expect(t.startsWith('Acme')).toBe(true);
    expect(chat).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'system' }),
        expect.objectContaining({ role: 'user' }),
      ]),
      expect.objectContaining({ purpose: 'content', temperature: 0.3 })
    );
  });

  it('falls back when title too short', async () => {
    const chat = jest.fn().mockResolvedValue({ text: 'no', model: 'm' });
    const llm = { chat } as unknown as LlmService;
    const svc = new ContentGenerationService(cfg(true), llm);
    const t = await svc.rewriteTitle({
      product,
      baseTitle: 'Base Title Here',
      baseDescription: 'desc',
    });
    expect(t).toBe('Base Title Here');
  });
});
