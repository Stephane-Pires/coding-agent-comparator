import { defineConfig } from 'vite-plus';

/**
 * The whole toolchain is configured here: Vite+ ignores `.oxlintrc.json` and `.oxfmtrc.json`.
 * The `no-restricted-imports` blocks mirror `tooling/architecture.ts`, which stays the single source of truth.
 */

/** Negated patterns that leave only relative imports allowed. Each layer adds its own exceptions. */
const ONLY_RELATIVE = ['*', '!./*', '!../*', '!./**', '!../**'];

export default defineConfig({
  fmt: {
    printWidth: 110,
    singleQuote: true,
    semi: true,
    trailingComma: 'all',
    sortPackageJson: false,
    // Node built-ins, then external packages, then @comparator/* packages, then relative files.
    sortImports: { internalPattern: ['@comparator/'] },
    ignorePatterns: ['pnpm-lock.yaml', 'fixtures/**'],
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
    plugins: ['typescript', 'unicorn', 'oxc', 'import', 'promise', 'vitest'],
    categories: { correctness: 'error', suspicious: 'warn', perf: 'warn' },
    env: { builtin: true, es2024: true },
    ignorePatterns: ['**/node_modules/**', 'fixtures/**'],
    rules: {
      'typescript/no-explicit-any': 'error',
      'typescript/consistent-type-imports': 'error',
      'typescript/no-floating-promises': 'error',
      'typescript/no-misused-promises': 'error',
      'import/no-cycle': 'error',
      eqeqeq: 'error',
    },
    overrides: [
      {
        files: ['packages/domain/src/**'],
        excludeFiles: ['**/*.test.ts'],
        rules: {
          'no-restricted-imports': [
            'error',
            {
              patterns: [
                {
                  group: [...ONLY_RELATIVE, '!zod', '!zod/**', '!neverthrow'],
                  message:
                    'Hexagonal rule: the domain may only import zod and neverthrow (see tooling/architecture.ts).',
                },
              ],
            },
          ],
        },
      },
      {
        files: ['packages/application/src/**'],
        excludeFiles: ['**/*.test.ts'],
        rules: {
          'no-restricted-imports': [
            'error',
            {
              patterns: [
                {
                  group: [...ONLY_RELATIVE, '!@comparator/domain', '!neverthrow'],
                  message:
                    'Hexagonal rule: the application layer may only import @comparator/domain and neverthrow (see tooling/architecture.ts).',
                },
              ],
            },
          ],
        },
      },
      {
        files: ['apps/web/src/**', 'packages/ui/src/**'],
        excludeFiles: ['**/*.test.ts', '**/*.test.tsx'],
        rules: {
          'no-restricted-imports': [
            'error',
            {
              patterns: [
                {
                  group: [
                    '@comparator/*',
                    '!@comparator/contracts',
                    '!@comparator/ui',
                    'hono',
                    '@hono/*',
                    '@orpc/server',
                    '@orpc/server/*',
                    '@anthropic-ai/claude-agent-sdk',
                    '@openai/codex-sdk',
                    '@vercel/sandbox',
                    'node:*',
                  ],
                  message:
                    'Isolation rule: UI code only talks to the backend through the oRPC contract in @comparator/contracts (see tooling/architecture.ts).',
                },
              ],
            },
          ],
        },
      },
      {
        files: ['**/*.test.ts', '**/*.test.tsx'],
        rules: { 'typescript/no-non-null-assertion': 'off' },
      },
    ],
  },
  test: {
    include: ['tooling/**/*.test.ts', 'packages/**/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
  },
  staged: {
    '*': 'vp check --fix',
  },
});
