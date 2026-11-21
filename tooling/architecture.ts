/**
 * Single source of truth for the hexagonal dependency rules (docs/adr/0001-hexagonal-architecture.md).
 *
 * Read by `tooling/boundaries.test.ts`, which checks every import in every workspace package and every
 * `@comparator/*` dependency declared in a package.json. `vite.config.ts` mirrors the main rules for fast
 * feedback in the editor.
 */

export type Layer = 'domain' | 'application' | 'contracts' | 'adapter' | 'app' | 'ui';

export interface PackageRule {
  readonly dir: string;
  readonly layer: Layer;
  /** Workspace packages this package may import. `'*'` means any. */
  readonly internal: readonly string[];
  /** External specifiers allowed (prefix match). `'*'` means any, minus `forbiddenExternal`. */
  readonly external: readonly string[];
  readonly forbiddenExternal?: readonly string[];
}

export const SCOPE = '@comparator/';

const UI_FRAMEWORKS = ['react', 'react-dom', 'next'];
/** What only the backend may load: the HTTP server, the agents and the sandbox. */
const SERVER_ONLY = [
  'hono',
  '@hono/',
  '@orpc/server',
  '@anthropic-ai/claude-agent-sdk',
  '@anthropic-ai/sdk',
  '@openai/codex-sdk',
  '@vercel/sandbox',
];
const RUNTIME = ['node:'];

/** A driven adapter implements a port: it depends on the core only, never on another adapter, the API or the UI. */
const adapter = (dir: string): PackageRule => ({
  dir,
  layer: 'adapter',
  internal: ['@comparator/domain', '@comparator/application'],
  external: ['*'],
  forbiddenExternal: [...UI_FRAMEWORKS, 'hono', '@hono/', '@orpc/'],
});

/** UI code reaches the backend only through the oRPC contract. */
const ui = (dir: string, internal: readonly string[]): PackageRule => ({
  dir,
  layer: 'ui',
  internal,
  external: ['*'],
  forbiddenExternal: [...SERVER_ONLY, ...RUNTIME],
});

export const RULES: Readonly<Record<string, PackageRule>> = {
  '@comparator/domain': {
    dir: 'packages/domain',
    layer: 'domain',
    internal: [],
    external: ['zod', 'neverthrow'],
  },
  '@comparator/application': {
    dir: 'packages/application',
    layer: 'application',
    internal: ['@comparator/domain'],
    external: ['neverthrow'],
  },
  '@comparator/contracts': {
    dir: 'packages/contracts',
    layer: 'contracts',
    internal: ['@comparator/domain'],
    external: ['zod', '@orpc/contract'],
  },
  '@comparator/connector-claude-code': adapter('packages/connectors/claude-code'),
  '@comparator/connector-codex': adapter('packages/connectors/codex'),
  '@comparator/connector-anthropic-api': adapter('packages/connectors/anthropic-api'),
  '@comparator/workspace-local': adapter('packages/workspace-local'),
  '@comparator/runtime-recorded': adapter('packages/runtime-recorded'),
  // It also imports itself by name: the form shadcn's generated components use.
  '@comparator/ui': ui('packages/ui', ['@comparator/contracts', '@comparator/ui']),
  '@comparator/server': {
    dir: 'apps/server',
    layer: 'app',
    internal: ['*'],
    external: ['*'],
    forbiddenExternal: UI_FRAMEWORKS,
  },
  '@comparator/web': ui('apps/web', ['@comparator/contracts', '@comparator/ui']),
};

/** Layers allowed to use runtime built-ins (`node:*`). */
export const RUNTIME_LAYERS: ReadonlySet<Layer> = new Set(['adapter', 'app']);
export const RUNTIME_PREFIXES = RUNTIME;
