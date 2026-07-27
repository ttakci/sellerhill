import { describe, expect, it } from 'vitest';

describe('web test harness', () => {
  it('runs in a browser-like environment', () => {
    expect(window.document).toBeDefined();
  });
});
