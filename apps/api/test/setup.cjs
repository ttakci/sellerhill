// apps/api/test/setup.cjs
//
// Jest setup — loads the reflect-metadata polyfill BEFORE any spec imports
// `@repo/shared`. The shared package's CJS build evaluates class-validator /
// class-transformer decorators (orders, billing schemas) at module-load time,
// and those decorators call Reflect.getMetadata. Without this polyfill the
// very first `import { ... } from '@repo/shared'` in any spec throws
// `TypeError: Reflect.getMetadata is not a function`.
//
// Loaded via jest.config.js `setupFiles` (runs before the test framework).
require('reflect-metadata');
