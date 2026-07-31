// UI-specific ESLint overrides
import baseConfig from '../eslint.config.js';
import angular from 'angular-eslint';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier';
import * as angularTemplateParser from '@angular-eslint/template-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toFlatConfigArray = (config) => (Array.isArray(config) ? config : [config]);
/**
 * Returns a copy of each config object with the given `files` pattern applied.
 * Needed because angular-eslint's shared template configs ship without a
 * `files` filter, which would otherwise make the Angular template parser run
 * on `.ts` files and crash.
 */
const withFiles = (configs, files) => toFlatConfigArray(configs).map((config) => ({ ...config, files }));

export default [
  ...baseConfig,
  ...toFlatConfigArray(angular.configs.tsRecommended),
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    processor: angular.processInlineTemplates,
    rules: {
      // UI-specific rules
      '@angular-eslint/component-max-inline-declarations': ['error', { animations: 15, styles: 0, template: 0 }],
      '@angular-eslint/component-selector': [
        'error',
        { type: ['attribute', 'element'], prefix: 'ui', style: 'kebab-case' },
      ],
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'ui', style: 'camelCase' }],
      '@typescript-eslint/no-extraneous-class': [
        'error',
        { allowConstructorOnly: true, allowEmpty: true, allowWithDecorator: true },
      ],
    },
  },
  // Unit test spec files are in tsconfig.spec.json (excluded from tsconfig.app.json).
  // Point them to the correct tsconfig so the ESLint project service resolves them.
  {
    files: ['**/*.spec.ts', '**/*.test.ts', 'ui/**/*.spec.ts', 'ui/**/*.test.ts'],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: path.resolve(__dirname, 'tsconfig.spec.json'),
      },
    },
  },
  // E2E tests (Playwright) are not part of any Angular project.
  // Disable project-service-dependent rules so TypeScript doesn't complain.
  {
    files: ['**/e2e/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: null,
      },
    },
    rules: {
      '@angular-eslint/component-selector': 'off',
      '@angular-eslint/directive-selector': 'off',
      '@angular-eslint/component-max-inline-declarations': 'off',
    },
  },
  // Config files (playwright, vitest, etc.) are not part of any Angular project.
  {
    files: ['**/playwright.config.ts', '**/vitest.config.ts'],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: null,
      },
    },
  },
  ...withFiles(angular.configs.templateRecommended, ['**/*.html']),
  ...withFiles(angular.configs.templateAccessibility, ['**/*.html']),
  // Must be last — disables @stylistic / @angular-eslint rules that conflict with Prettier.
  eslintConfigPrettier,
  // Check Prettier formatting for Angular HTML templates.
  // Must come AFTER eslintConfigPrettier since that disables prettier/prettier.
  {
    files: ['**/*.html'],
    languageOptions: {
      parser: angularTemplateParser,
    },
    plugins: {
      prettier: eslintPluginPrettier,
    },
    rules: {
      'prettier/prettier': ['warn', { parser: 'angular' }],
    },
  },
];
