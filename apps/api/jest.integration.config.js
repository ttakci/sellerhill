const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  testRegex: '.*[.]integration-spec[.]ts$',
  testTimeout: 120000,
};
