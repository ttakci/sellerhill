import type { CategoryAspect } from './aspect-builder';
import { buildAspectPrompt, parseAspectChoice } from './aspect-llm.service';

const selection = (name: string, values: string[]): CategoryAspect => ({
  name,
  required: true,
  selectionOnly: true,
  multiValue: false,
  values,
});

const freeText = (name: string): CategoryAspect => ({
  name,
  required: true,
  selectionOnly: false,
  multiValue: false,
  values: [],
});

describe('buildAspectPrompt', () => {
  const aspect = selection('Food Aisle', ['Pantry', 'Refrigerated', 'Frozen']);

  it('gives the model the product, the attribute and the allowed values', () => {
    const [system, user] = buildAspectPrompt({
      aspect,
      productTitle: 'Badia Complete Seasoning, 6 oz',
      productFeatures: ['All purpose seasoning'],
      categoryName: 'Spices',
    });

    expect(system.role).toBe('system');
    expect(user.content).toContain('Badia Complete Seasoning');
    expect(user.content).toContain('Food Aisle');
    expect(user.content).toContain('Pantry | Refrigerated | Frozen');
  });

  it('bounds the allowed-value list so a huge colour list cannot blow the prompt', () => {
    const many = selection(
      'Color',
      Array.from({ length: 300 }, (_, index) => `Color ${index}`)
    );
    const [, user] = buildAspectPrompt({ aspect: many, productTitle: 'Thing' });

    expect(user.content.split(' | ').length).toBeLessThanOrEqual(40);
  });
});

describe('parseAspectChoice', () => {
  const aspect = selection('Food Aisle', ['Pantry', 'Refrigerated', 'Frozen']);

  it('accepts a clean answer', () => {
    expect(parseAspectChoice('Pantry', aspect)).toBe('Pantry');
  });

  it('strips the reasoning block small local models emit', () => {
    // qwen3 and friends prepend <think>…</think> before the answer.
    expect(parseAspectChoice('<think>seasoning is shelf stable</think> Pantry', aspect)).toBe('Pantry');
  });

  it('finds the answer inside a sentence', () => {
    expect(parseAspectChoice('The correct value is "Refrigerated".', aspect)).toBe('Refrigerated');
  });

  it('rejects an invented value rather than failing the publish', () => {
    // A value off the list is exactly what eBay refuses.
    expect(parseAspectChoice('Room Temperature', aspect)).toBeNull();
  });

  it('honours the model declining', () => {
    expect(parseAspectChoice('NONE', aspect)).toBeNull();
    expect(parseAspectChoice('   ', aspect)).toBeNull();
  });

  it('keeps a bounded first line for free-text aspects', () => {
    expect(parseAspectChoice('Rolled. It is a rolled snack.', freeText('Item Form'))).toBe('Rolled');
    expect((parseAspectChoice('x'.repeat(200), freeText('Item Form')) ?? '').length).toBe(65);
  });
});
