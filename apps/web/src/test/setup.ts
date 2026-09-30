// `@repo/shared` carries class-validator DTOs whose decorators need the
// reflect polyfill, exactly as `main.tsx` loads it before anything else.
import 'reflect-metadata';

import '@testing-library/jest-dom/vitest';
