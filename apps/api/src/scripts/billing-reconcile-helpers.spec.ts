import { parseReconcileArgs, ReconcileArgError } from './billing-reconcile-helpers';

describe('parseReconcileArgs', () => {
  it('reads --email', () => {
    expect(parseReconcileArgs(['--email', 'a@b.c'])).toEqual({ email: 'a@b.c', dryRun: false });
  });

  it('ignores the literal "--" pnpm run forwards', () => {
    expect(parseReconcileArgs(['--', '--email', 'a@b.c']).email).toBe('a@b.c');
  });

  it('supports --dry-run', () => {
    expect(parseReconcileArgs(['--email', 'a@b.c', '--dry-run']).dryRun).toBe(true);
  });

  it('requires --email', () => {
    expect(() => parseReconcileArgs([])).toThrow(ReconcileArgError);
  });

  it('rejects an unknown flag', () => {
    expect(() => parseReconcileArgs(['--force'])).toThrow(ReconcileArgError);
  });
});
