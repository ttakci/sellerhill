import type { DatabaseService } from '../../common/database/database.service';

import { AspectResolutionLayer, type CategoryAspect } from './aspect-builder';
import type { AspectLlmService } from './aspect-llm.service';
import { AspectResolverService } from './aspect-resolver.service';

/** LLM layer off — these cases cover the deterministic + learned path. */
const disabledLlm = {
  isEnabled: () => Promise.resolve(false),
  maxAspectsPerListing: () => Promise.resolve(0),
  chooseValue: () => Promise.resolve(null),
} as unknown as AspectLlmService;

const selection = (name: string, values: string[], required = true): CategoryAspect => ({
  name,
  required,
  selectionOnly: true,
  multiValue: false,
  values,
});

interface StoredDefault {
  aspect_key: string;
  aspect_name: string;
  value: string;
  source: string;
  is_override: boolean;
  confidence: number;
  success_count: number;
}

function makeService(stored: StoredDefault[]): { service: AspectResolverService; queries: unknown[][] } {
  const queries: unknown[][] = [];
  const db = {
    query: jest.fn((sql: string, params?: unknown[]) => {
      queries.push([sql, params]);
      return Promise.resolve(sql.includes('SELECT DISTINCT ON') ? stored : []);
    }),
  } as unknown as DatabaseService;

  return { service: new AspectResolverService(db, disabledLlm), queries };
}

describe('AspectResolverService.resolve', () => {
  const request = {
    marketplaceId: 'EBAY_US',
    categoryId: '260988',
    categoryAspects: [selection('Department', ['Boys', 'Girls', 'Unisex Adult'])],
    product: { title: 'Badia Complete Seasoning' },
  };

  it('uses a learned value ahead of the built-in guess', async () => {
    const { service } = makeService([
      {
        aspect_key: 'department',
        aspect_name: 'Department',
        value: 'Girls',
        source: 'learned',
        is_override: false,
        confidence: 70,
        success_count: 4,
      },
    ]);

    const resolution = await service.resolve(request);

    expect(resolution.aspects.Department).toEqual(['Girls']);
    expect(resolution.decisions[0].layer).toBe(AspectResolutionLayer.LEARNED);
  });

  it('lets a curated override beat scraped product data', async () => {
    const { service } = makeService([
      {
        aspect_key: 'department',
        aspect_name: 'Department',
        value: 'Unisex Adult',
        source: 'curated',
        is_override: true,
        confidence: 100,
        success_count: 0,
      },
    ]);

    const resolution = await service.resolve({
      ...request,
      product: { ...request.product, specs: { Department: 'Boys' } },
    });

    expect(resolution.aspects.Department).toEqual(['Unisex Adult']);
  });

  it('discards a stored value eBay no longer allows', async () => {
    // eBay retires allowed values; a learned answer must be revalidated, not
    // replayed until the publish fails.
    const { service, queries } = makeService([
      {
        aspect_key: 'department',
        aspect_name: 'Department',
        value: 'Toddlers',
        source: 'learned',
        is_override: false,
        confidence: 80,
        success_count: 9,
      },
    ]);

    const resolution = await service.resolve(request);

    expect(resolution.aspects.Department).not.toEqual(['Toddlers']);
    expect(resolution.unresolvedRequired).toEqual([]);
    await Promise.resolve();
    expect(queries.some(([sql]) => String(sql).includes('stale_at = CURRENT_TIMESTAMP'))).toBe(true);
  });

  it('still produces a complete map when the defaults table is unavailable', async () => {
    // A settings/DB outage must never stop a listing: the pure layers alone
    // still resolve every required aspect.
    const db = {
      query: jest.fn(() => Promise.reject(new Error('relation does not exist'))),
    } as unknown as DatabaseService;

    const resolution = await new AspectResolverService(db, disabledLlm).resolve(request);

    expect(resolution.aspects.Department).toBeDefined();
    expect(resolution.unresolvedRequired).toEqual([]);
  });
});

describe('AspectResolverService LLM layer', () => {
  it('asks the model only for required aspects nothing else resolved, and learns the answer', async () => {
    const { service, queries } = makeService([]);
    const chooseValue = jest.fn(() => Promise.resolve('Pantry'));
    const llm = {
      isEnabled: () => Promise.resolve(true),
      maxAspectsPerListing: () => Promise.resolve(3),
      chooseValue,
    } as unknown as AspectLlmService;

    const withLlm = new AspectResolverService(
      (service as unknown as { databaseService: never }).databaseService,
      llm
    );

    const resolution = await withLlm.resolve({
      marketplaceId: 'EBAY_US',
      categoryId: '260988',
      categoryAspects: [
        // No product data, no built-in prior, nothing in the title.
        selection('Food Aisle', ['Pantry', 'Refrigerated', 'Frozen']),
        selection('Color', ['Black', 'Green']),
      ],
      product: { title: 'Badia Complete Seasoning', specs: { Color: 'Green' } },
    });

    // Color came from product data, so only Food Aisle was asked about — the
    // cheaper layers always run first.
    expect(chooseValue).toHaveBeenCalledTimes(1);
    expect(resolution.aspects['Food Aisle']).toEqual(['Pantry']);
    expect(resolution.aspects.Color).toEqual(['Green']);

    await Promise.resolve();
    expect(queries.some(([sql]) => String(sql).includes('INSERT INTO ebay_aspect_defaults'))).toBe(true);
  });

  it('falls back to the deterministic guarantee when the model declines', async () => {
    const { service } = makeService([]);
    const llm = {
      isEnabled: () => Promise.resolve(true),
      maxAspectsPerListing: () => Promise.resolve(3),
      chooseValue: () => Promise.resolve(null),
    } as unknown as AspectLlmService;

    const withLlm = new AspectResolverService(
      (service as unknown as { databaseService: never }).databaseService,
      llm
    );

    const resolution = await withLlm.resolve({
      marketplaceId: 'EBAY_US',
      categoryId: '260988',
      categoryAspects: [selection('Food Aisle', ['Pantry', 'Refrigerated', 'Frozen'])],
      product: { title: 'Badia Complete Seasoning' },
    });

    // The guarantee still holds without the model.
    expect(resolution.unresolvedRequired).toEqual([]);
    expect(resolution.aspects['Food Aisle']).toBeDefined();
  });
});

describe('AspectResolverService.recordPublishSuccess', () => {
  it('learns non-product values only', async () => {
    const { service, queries } = makeService([]);

    service.recordPublishSuccess('EBAY_US', '260988', {
      aspects: {},
      unresolvedRequired: [],
      decisions: [
        {
          aspectName: 'Department',
          value: 'Unisex Adult',
          layer: AspectResolutionLayer.TERMINAL_FALLBACK,
          required: true,
          selectionOnly: true,
        },
        // Product data is per-product; it teaches nothing about the category.
        {
          aspectName: 'Color',
          value: 'Black',
          layer: AspectResolutionLayer.PRODUCT_DATA,
          required: true,
          selectionOnly: false,
        },
      ],
    });

    await Promise.resolve();
    const inserts = queries.filter(([sql]) => String(sql).includes('INSERT INTO ebay_aspect_defaults'));
    expect(inserts).toHaveLength(1);
    expect(String(inserts[0][1])).toContain('Unisex Adult');
  });
});
