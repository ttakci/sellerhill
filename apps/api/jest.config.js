const path = require('path');

module.exports = {
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  moduleFileExtensions: ['js', 'json', 'ts', 'cjs'],
  testEnvironment: 'node',
  // `@repo/shared` ships a CJS build at dist/cjs; without this mapper Jest's
  // resolver follows the workspace symlink into packages/shared/src/index.ts
  // (TypeScript source), which pulls ESM-only deps that the Node test runtime
  // cannot parse.
  moduleNameMapper: {
    '^@repo/shared$': path.join(__dirname, '..', '..', 'packages', 'shared', 'dist', 'cjs', 'index.cjs'),
    // uuid@13 is ESM-only (`"type": "module"`); `@repo/shared`'s CJS build
    // requires it, so point Jest at a tiny CJS shim under test/.
    '^uuid$': '<rootDir>/test/uuid-shim.cjs',
  },
};
