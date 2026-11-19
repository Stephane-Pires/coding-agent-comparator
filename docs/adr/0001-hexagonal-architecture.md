# 0001 — Hexagonal architecture with enforced boundaries

- Status: accepted (2026-11-19)

## Context

The comparator sends one task to several coding agents and shows how each performed. The agents are the part that
will change: their SDKs move fast, each reports its work differently (see [spike-findings.md](../spike-findings.md)),
and more agents may be added. Where they run changes too: a temp folder on a dev machine, a sandbox in production.
The rules of a comparison should not change with any of that.

## Decision

- `domain` (Zod schemas and pure rules) and `application` (use cases and the ports they need) form the core.
- Each coding agent is its own driven-adapter package, `packages/connectors/<agent>`, added with ticket 03.
- `apps/server` is the composition root of the API. It wires adapters to use cases and holds no rule of its own.
- `contracts` holds the oRPC contract. Its DTOs are derived from the domain schemas.
- Packages are layers, because the import rules need a package to be enforced. Features are vertical slices: inside a
  layer, code is grouped by capability folder (`comparison`), and each ticket adds one thin slice through every layer.
  No layer is built ahead of the slice that uses it.
- The UI is isolated: `apps/web` and `packages/ui` depend only on `@comparator/contracts` and `@comparator/ui`. They
  never import the domain, the server, an agent SDK or a Node built-in.

| Package                   | May import (workspace) | May import (external)                             |
| ------------------------- | ---------------------- | ------------------------------------------------- |
| `@comparator/domain`      | nothing                | `zod`, `neverthrow`                               |
| `@comparator/application` | `domain`               | `neverthrow`                                      |
| `@comparator/contracts`   | `domain`               | `zod`, `@orpc/contract`                           |
| `@comparator/ui`          | `contracts`            | anything except server-only packages and `node:*` |
| `@comparator/web`         | `contracts`, `ui`      | anything except server-only packages and `node:*` |
| `@comparator/server`      | everything             | anything except `react`, `react-dom`, `next`      |

Server-only packages: `hono`, `@hono/*`, `@orpc/server`, `@anthropic-ai/claude-agent-sdk`, `@openai/codex-sdk`,
`@vercel/sandbox`.

## Enforcement

`tooling/architecture.ts` is the single source of truth. Two checks read or mirror it:

1. `tooling/boundaries.test.ts` checks every import of every source file, and every `@comparator/*` dependency
   declared in a `package.json`. It also fails when a workspace package has no rule, so a new package cannot be added
   outside the architecture.
2. The `lint` block of `vite.config.ts` mirrors the domain, application and UI rules with `no-restricted-imports`,
   for feedback in the editor. `import/no-cycle` forbids circular imports.

Both run in `pnpm check` (format, lint, type-check, tests). Before every commit, `.vite-hooks/pre-commit` formats,
lints and type-checks the staged files, then runs the tests. `pnpm install` enables the hook. There is no CI yet.

Verified on 2026-11-19:

- `import 'hono'`, `import '@comparator/application'` and `import 'node:fs'` in `packages/domain` each failed both
  the lint and the boundaries test. So did `import 'zod'` in `packages/application`.
- `import '@comparator/domain'` and `import '@orpc/server'` in `apps/web` each failed both.
- Two files importing each other failed the lint (`import/no-cycle`).
- On a fresh copy, a commit with a forbidden import was refused by the hook, and so was a commit with a failing test.

## Toolchain: Vite+

The toolchain is Vite+ (`vite-plus` 1.7.0): one dependency that brings Oxlint, Oxfmt, Vitest and a type checker, and
one config file, `vite.config.ts`.

| Command      | What it does                                                    |
| ------------ | --------------------------------------------------------------- |
| `pnpm check` | `vp check` (format, lint, type-check), then `vp test run`       |
| `pnpm fix`   | `vp check --fix`: formats and applies the safe lint fixes       |
| `pnpm test`  | `vp test run`                                                   |
| pre-commit   | `vp staged` (runs `vp check --fix` on staged files), then tests |

Three things to know:

- **All settings live in `vite.config.ts`.** Vite+ ignores `.oxlintrc.json` and `.oxfmtrc.json`: with the rules left
  in `.oxlintrc.json`, `vp lint` passed while violations were present. Do not add those files back.
- **The type checker is `tsrs` 7.1.0, a beta.** `typescript` stays installed for the editor only.
- **Not yet tried with Storybook** (ticket 08), which builds with Vite. Next.js (ticket 09) does not build with Vite,
  so only check, test and the hook apply to it.

Fallback if Vite+ conflicts with Storybook or its beta type checker misbehaves: plain `oxlint --type-aware`, `oxfmt`,
`tsc` and `vitest` scripts with a `.githooks/pre-commit`, as tried first on 2026-11-19 (it passed the same checks).
