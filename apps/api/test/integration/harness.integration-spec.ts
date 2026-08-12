import { assertSafeIntegrationDatabase } from './environment';

describe('API integration test harness', () => {
  it('accepts explicitly marked disposable databases', () => {
    expect(() => assertSafeIntegrationDatabase('assistant_sellerhill_test')).not.toThrow();
  });

  it('rejects unmarked databases', () => {
    expect(() => assertSafeIntegrationDatabase('sellerhill')).toThrow(
      'Integration database name must include _sellerhill_test',
    );
  });
});
