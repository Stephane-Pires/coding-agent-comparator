import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

import { RULES, RUNTIME_LAYERS, RUNTIME_PREFIXES, SCOPE, type PackageRule } from './architecture.ts';

const ROOT = join(import.meta.dirname, '..');
const SOURCE_EXT = /\.tsx?$/;
const IMPORT_RE =
  /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return []; // a package with no code yet
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    if (/\.test\.tsx?$/.test(name)) return []; // test code is not a runtime dependency
    return SOURCE_EXT.test(name) ? [path] : [];
  });
}

function importsOf(code: string): string[] {
  return [...code.matchAll(IMPORT_RE)].map((m) => m[1] ?? m[2] ?? '').filter(Boolean);
}

const matches = (spec: string, prefixes: readonly string[]) =>
  prefixes.some((p) => spec === p || spec.startsWith(p.endsWith('/') || p.endsWith(':') ? p : `${p}/`));

/** Returns a reason string when `spec` is not allowed from a package with `rule`, otherwise null. */
function violation(spec: string, rule: PackageRule): string | null {
  if (spec.startsWith('.')) return null;
  if (spec.startsWith(SCOPE)) {
    const target = spec.split('/').slice(0, 2).join('/');
    return rule.internal.includes('*') || rule.internal.includes(target)
      ? null
      : `${rule.layer} layer may not import ${target}`;
  }
  if (rule.forbiddenExternal && matches(spec, rule.forbiddenExternal))
    return `forbidden in ${rule.layer} layer`;
  if (matches(spec, RUNTIME_PREFIXES) && !RUNTIME_LAYERS.has(rule.layer))
    return `runtime built-ins are not allowed in ${rule.layer} layer`;
  if (rule.external.includes('*') || matches(spec, rule.external)) return null;
  return `external dependency not allowed in ${rule.layer} layer`;
}

describe('architecture boundaries', () => {
  for (const [name, rule] of Object.entries(RULES)) {
    it(`${name} only imports what its layer allows`, () => {
      const found = sourceFiles(join(ROOT, rule.dir, 'src')).flatMap((file) =>
        importsOf(readFileSync(file, 'utf8')).flatMap((spec) => {
          const reason = violation(spec, rule);
          return reason ? [`${file.replace(`${ROOT}/`, '')}: '${spec}' (${reason})`] : [];
        }),
      );
      expect(found).toEqual([]);
    });

    it(`${name} only declares allowed ${SCOPE} dependencies`, () => {
      const pkg: unknown = JSON.parse(readFileSync(join(ROOT, rule.dir, 'package.json'), 'utf8'));
      if (typeof pkg !== 'object' || pkg === null)
        throw new Error(`${rule.dir}/package.json is not an object`);
      expect('name' in pkg ? pkg.name : undefined).toBe(name);
      const deps = 'dependencies' in pkg && typeof pkg.dependencies === 'object' ? pkg.dependencies : null;
      const bad = Object.keys(deps ?? {}).filter(
        (dep) => dep.startsWith(SCOPE) && violation(dep, rule) !== null,
      );
      expect(bad).toEqual([]);
    });
  }

  it('has a rule for every workspace package', () => {
    const packages = ['apps', 'packages', 'packages/connectors']
      .filter((parent) => existsSync(join(ROOT, parent)))
      .flatMap((parent) => readdirSync(join(ROOT, parent)).map((name) => `${parent}/${name}`))
      .filter((dir) => existsSync(join(ROOT, dir, 'package.json')));
    expect(packages.toSorted()).toEqual(
      Object.values(RULES)
        .map((rule) => rule.dir)
        .toSorted(),
    );
  });
});

describe('boundary checker itself', () => {
  const domain = RULES['@comparator/domain']!;
  const application = RULES['@comparator/application']!;
  const contracts = RULES['@comparator/contracts']!;
  const uiPackage = RULES['@comparator/ui']!;
  const server = RULES['@comparator/server']!;
  const codex = RULES['@comparator/connector-codex']!;
  const web = RULES['@comparator/web']!;

  it('extracts static, type-only, side-effect and dynamic imports', () => {
    const code = `import a from 'x'; import type { B } from "y"; import 'z'; export * from './w'; await import('v');`;
    expect(importsOf(code)).toEqual(['x', 'y', 'z', './w', 'v']);
  });

  it.each([
    ['hono', domain],
    ['node:fs', domain],
    ['@comparator/application', domain],
    ['@comparator/connector-codex', domain],
    ['@openai/codex-sdk', application],
    ['zod', application],
    ['hono', contracts],
    ['@comparator/application', contracts],
    ['@comparator/domain', uiPackage],
    ['@comparator/domain', web],
    ['@comparator/server', web],
    ['@orpc/server', web],
    ['@anthropic-ai/claude-agent-sdk', web],
    ['node:fs', web],
    ['react', server],
    ['@comparator/connector-claude-code', codex],
    ['@comparator/contracts', codex],
    ['hono', codex],
    ['@orpc/server', codex],
  ])('rejects %s', (spec, rule) => {
    expect(violation(spec, rule)).not.toBeNull();
  });

  it.each([
    ['./run.ts', domain],
    ['zod', domain],
    ['zod/v4', domain],
    ['neverthrow', domain],
    ['@comparator/domain', application],
    ['@comparator/domain', contracts],
    ['@orpc/contract', contracts],
    ['@comparator/contracts', uiPackage],
    ['react', uiPackage],
    ['@comparator/ui', web],
    ['@orpc/client', web],
    ['react-dom/client', web],
    ['node:fs', server],
    ['hono', server],
    ['@comparator/application', server],
    ['@comparator/application', codex],
    ['@openai/codex-sdk', codex],
    ['node:child_process', codex],
  ])('accepts %s', (spec, rule) => {
    expect(violation(spec, rule)).toBeNull();
  });
});
