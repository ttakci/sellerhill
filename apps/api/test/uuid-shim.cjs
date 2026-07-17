/**
 * Jest-only CJS shim for the `uuid` package.
 *
 * `uuid@13` ships ESM-only (`"type": "module"`, `export ...`), which the Jest
 * Node test runtime cannot parse when `@repo/shared/dist/cjs/*` requires it.
 * `@repo/shared` uses exactly one export from `uuid` — `v4` — for request IDs
 * in a code path the profit-calculation tests never touch. This shim provides
 * a deterministic stub so module resolution succeeds without forcing ESM,
 * Babel, or a global `jest.mock` setup file.
 */
module.exports = {
  v4: () => '00000000-0000-4000-8000-000000000000',
};
