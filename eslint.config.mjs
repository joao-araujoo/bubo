// Flat ESLint config for the whole monorepo (ESLint 10 + typescript-eslint).
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.expo/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.wrangler/**',
      '**/.local/**',
      '**/expo-env.d.ts',
      'apps/mobile/android/**',
      'apps/mobile/ios/**',
      'Bubo - Assets/**',
      'stitch_bubo_read_deeply/**',
      'assets-source/**',
      '.tmp-inspect/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-nocheck': true, 'ts-expect-error': 'allow-with-description' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
      'prefer-const': 'error',
    },
  },
  {
    // Node tooling scripts may log to the console.
    files: ['**/scripts/**/*.{mjs,ts}', '**/*.config.{js,mjs,cjs,ts}', '**/metro.config.js'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off', '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['apps/mobile/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser, __DEV__: 'readonly' } },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      // Static asset registries use require() so Metro can bundle images/fonts.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['apps/api/**/*.ts', 'packages/**/*.ts'],
    languageOptions: { globals: { ...globals.worker } },
  },
  {
    // The API logger is the single sanctioned console sink (structured JSON logs for Workers).
    files: ['apps/api/src/lib/logger.ts'],
    rules: { 'no-console': 'off' },
  },
);
