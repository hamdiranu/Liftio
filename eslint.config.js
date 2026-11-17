// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  {
    // Deno Edge Functions use `npm:` specifiers and are checked by the Supabase CLI / Deno.
    ignores: ['dist/*', 'public/*', '.expo/**', 'supabase/functions/**'],
  },
  {
    // Build-time Node scripts.
    files: ['scripts/**/*.{js,mjs,mts}', '*.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.mts'],
    languageOptions: { parser: require('@typescript-eslint/parser') },
  },
]);
