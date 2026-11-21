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
      'import/no-unassigned-import': ['warn', { allow: ['**/*.css'] }],
      // A run is a stream: its events are awaited one after the other on purpose.
      'no-await-in-loop': 'off',
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
        files: [
          'packages/connectors/*/src/**',
          'packages/workspace-local/src/**',
          'packages/runtime-recorded/src/**',
        ],
        excludeFiles: ['**/*.test.ts'],
        rules: {
          'no-restricted-imports': [
            'error',
            {
              patterns: [
                {
                  group: [
                    '@comparator/*',
                    '!@comparator/domain',
                    '!@comparator/application',
                    'hono',
                    '@hono/*',
                    '@orpc/*',
                    'react',
                    'react-dom',
                    'next',
                  ],
                  message:
                    'Hexagonal rule: an adapter depends on the core only, never on another adapter, the API or the UI (see tooling/architecture.ts).',
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
        // What shadcn and AI Elements generate: library code, kept close to the registry's version.
        files: ['packages/ui/src/components/ui/**', 'packages/ui/src/components/ai-elements/**'],
        rules: { 'typescript/no-floating-promises': 'off', 'typescript/no-unsafe-type-assertion': 'off' },
      },
      {
        files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts'],
        rules: {
          'typescript/no-non-null-assertion': 'off',
          // Tests load recorded JSON and build deliberately wrong values.
          'typescript/no-unsafe-type-assertion': 'off',
          // neverthrow names its test helper `_unsafeUnwrap`.
          'no-underscore-dangle': 'off',
        },
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
