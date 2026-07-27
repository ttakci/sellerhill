import { assertSafeIntegrationDatabase } from './environment';

describe('API integration test harness', () => {
  it('accepts explicitly marked disposable databases', () => {
    expect(() => assertSafeIntegrationDatabase('assistant_zonds_test')).not.toThrow();
  });

  it('rejects unmarked databases', () => {
    expect(() => assertSafeIntegrationDatabase('zonds')).toThrow(
      'Integration database name must include _zonds_test',
    );
  });
});
