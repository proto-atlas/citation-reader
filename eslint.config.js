// ESLint 10 flat config
// 各プロジェクトで fork → React/Vue 固有ルールを追加
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.next/**',
      '.nuxt/**',
      '.output/**',
      '.open-next/**',
      '.wrangler/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'public/**',
      'scripts/**/*.mjs',
      // LLM evaluation harness の runner は Node スクリプトで TS プロジェクト外。
      // 純関数 (eval/evaluators.ts) は Vitest で型チェック + テスト済。
      'eval/**/*.mjs',
      // ローカル QA / 外部レビュー成果物 (.gitignore 対象、tsconfig に含まれない)
      '_qa-*',
      'review-artifacts/**',
      '**/*.config.js',
      '**/*.config.ts',
      '**/*.config.mjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // TypeScript
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',

      // General
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  // Prettier 連携は最後に置いて他のフォーマット系ルールを無効化
  prettierConfig,
);
