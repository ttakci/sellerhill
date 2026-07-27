import { beforeEach, describe, expect, it, vi } from 'vitest';

import { configureAuthRefreshCoordinator, isAuthRefreshPending, refreshAuthSession } from './authRefreshCoordinator';

describe('authRefreshCoordinator', () => {
  beforeEach(() => {
    configureAuthRefreshCoordinator(() => Promise.resolve({ accessToken: null, success: false }));
  });

  it('shares one in-flight refresh between callers', async () => {
    let resolve!: (value: { accessToken: string; success: true }) => void;
    const refresh = vi.fn(() => new Promise<{ accessToken: string; success: true }>((done) => { resolve = done; }));
    configureAuthRefreshCoordinator(refresh);

    const first = refreshAuthSession();
    const second = refreshAuthSession();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(isAuthRefreshPending()).toBe(true);

    resolve({ accessToken: 'next', success: true });
    await expect(first).resolves.toEqual({ accessToken: 'next', success: true });
    await expect(second).resolves.toEqual({ accessToken: 'next', success: true });
    expect(isAuthRefreshPending()).toBe(false);
  });
});
