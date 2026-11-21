import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

import { RULES, SCOPE } from './architecture.ts';

// A hosted API is a function of 250 MB at most, and each agent's SDK brings a binary larger than that. So the file
// Vercel starts from must not reach either SDK, through any chain of imports. Type-only imports do not count:
// they are gone before the code runs.
const ROOT = join(import.meta.dirname, '..');
const ENTRY = join(ROOT, 'apps/server/src/index.ts');
const AGENT_SDKS = ['@anthropic-ai/claude-agent-sdk', '@openai/codex-sdk'];
const RUNTIME_IMPORT = /^(?:import|export)\s+(?!type\s)(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm;

/** The source file a workspace import names, read from the package's `exports`. */
function workspaceFile(spec: string): string {
  const name = Object.keys(RULES).find((known) => spec === known || spec.startsWith(`${known}/`));
  if (name === undefined) throw new Error(`Unknown workspace package in "${spec}"`);
  const dir = join(ROOT, RULES[name]?.dir ?? '');
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
    exports: Record<string, string>;
  };
  const target = manifest.exports[`.${spec.slice(name.length)}`];
  if (target === undefined) throw new Error(`"${spec}" is not in the exports of ${name}`);
  return join(dir, target);
}

/** Every external package reachable at run time from `file`, with the chain of files that leads to it. */
function reachable(
  file: string,
  chain: readonly string[],
  seen: Set<string>,
): Map<string, readonly string[]> {
  const found = new Map<string, readonly string[]>();
  if (seen.has(file)) return found;
  seen.add(file);
  const here = [...chain, file.slice(ROOT.length + 1)];
  for (const [, spec = ''] of readFileSync(file, 'utf8').matchAll(RUNTIME_IMPORT)) {
    const next = spec.startsWith('.')
      ? join(dirname(file), spec)
      : spec.startsWith(SCOPE)
        ? workspaceFile(spec)
        : undefined;
    if (next === undefined) found.set(spec, here);
    else if (existsSync(next)) for (const [k, v] of reachable(next, here, seen)) found.set(k, v);
  }
  return found;
}

describe('the entry of the hosted API', () => {
  const externals = reachable(ENTRY, [], new Set());

  it('reaches what it needs: the HTTP server, the sandbox and the Anthropic API', () => {
    expect([...externals.keys()]).toEqual(
      expect.arrayContaining(['hono', '@vercel/sandbox', '@anthropic-ai/sdk']),
    );
  });

  it.each(AGENT_SDKS)('never loads %s: its binary does not fit in a function', (sdk) => {
    // When this fails, the value shown is the chain of files that leads to the SDK.
    expect(externals.get(sdk)).toBeUndefined();
  });
});
