// apps/api/src/modules/listings/content-generation.service.spec.ts
import { ConfigService } from '@nestjs/config';
import type { ProductData } from '@repo/shared';

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

function cfg(enabled: string): ConfigService {
  return {
    get: (k: string) => (k === 'LLM_CONTENT_ENABLED' ? enabled : undefined),
  } as unknown as ConfigService;
}

describe('ContentGenerationService', () => {
  it('returns base when disabled', async () => {
    const chat = jest.fn();
    const llm = { chat } as unknown as LlmService;
    const svc = new ContentGenerationService(cfg('false'), llm);
    const t = await svc.rewriteTitle({
      product,
      baseTitle: 'Base Title Here',
      baseDescription: 'desc',
    });
    expect(t).toBe('Base Title Here');
    expect(chat).not.toHaveBeenCalled();
  });

  it('returns base on LlmError', async () => {
    const chat = jest.fn().mockRejectedValue(new LlmTimeoutError());
    const llm = { chat } as unknown as LlmService;
    const svc = new ContentGenerationService(cfg('true'), llm);
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
    const svc = new ContentGenerationService(cfg('true'), llm);
    const t = await svc.rewriteTitle({
      product,
      baseTitle: 'Base Title Here',
      baseDescription: 'desc',
    });
    expect(t).toBe('Great Widget Deal');
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
    const svc = new ContentGenerationService(cfg('true'), llm);
    const t = await svc.rewriteTitle({
      product,
      baseTitle: 'Base Title Here',
      baseDescription: 'desc',
    });
    expect(t).toBe('Base Title Here');
  });
});
