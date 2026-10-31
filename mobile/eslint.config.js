const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', 'dist-requirements-check/**'] },
  // Node's CommonJS test runner provides __dirname in these test files.
  { files: ['tests/**/*.cjs'], languageOptions: { globals: { __dirname: 'readonly' } } },
]);
