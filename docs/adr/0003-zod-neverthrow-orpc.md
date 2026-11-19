# 0003 — Zod for the model, errors as values, oRPC for the API

- Status: accepted (2026-11-19)

Number 0002 is reserved for the storage decision (history in the browser), which comes with its own slice.

## Context

Two agents report their work in two different shapes, and both can fail in several ways: a refused model, a crash, a
cancel ([spike-findings.md](../spike-findings.md)). The API is read by a web app and by people, so its shapes must be
documented, and the documentation must not drift from the code.

## Decision

1. **Zod is the modelling language of the domain.** A schema and its type share one name (`Task`, `AgentId`,
   `RunEvent`). There is no second, hand-written type to keep in sync.
2. **Parse once, at the edge.** `Task` is a branded type: the only way to get one is to parse it, and the API does
   that on the way in. Inner layers receive values that are already valid and carry no checks.
3. **Expected failures are values, never exceptions.**
   - An operation that can fail returns a neverthrow `Result`: `WorkspaceProvider.create`, `readConfig`.
   - A run that fails is not an error of the API. It is the run's last event: `finished` with the outcome `failed`
     and a reason, or `cancelled`. The stream answers 200 and carries it.
4. **One place owns how a run ends.** `startRun` guarantees exactly one `finished` event, with nothing after it, and
   the disposal of the workspace. A connector only translates; it may throw when its agent crashes or is aborted, and
   `startRun` turns that into the outcome. This is the one port where a throw is allowed, because both agents report a
   failure twice (an event, then a thrown error) and the rule that absorbs it should exist once.
5. **The API is contract-first with oRPC.** `packages/contracts` holds the contract. Its inputs and outputs are built
   from the domain schemas. `apps/server` implements it on Hono and serves it twice: `/rpc` for the typed client and
   `/api` as plain REST. The OpenAPI document is generated from the contract and shown by Scalar at `/docs`.
6. **The stream speaks the AI SDK's UI message protocol.** The chunks are declared in the contract (`RunChunk`), so
   they are documented, and `useChat` can render them. The server does not depend on the AI SDK.

## Consequences

- Adding an event kind is one change per layer: the domain schema, each connector's translator, the contract's chunk,
  the presenter. The type checker points at each place.
- The web app never imports the domain. It sees the contract's types only (ADR 0001).
- A failure reason is the agent's own text for now. Mapping reasons to actions the user can take belongs to the
  error-states slice.

## Evidence

Verified on 2026-11-19, with the real agents on subscription logins (Claude Code on Haiku, Codex on `gpt-6-luna`):

- `POST /api/runs` streamed a successful run of each agent: text, then the outcome `succeeded`.
- A wrong model gave the outcome `failed` with the agent's message, from two different native shapes.
- Closing the connection stopped the run and removed its workspace.
- `{ "agent": "gemini", "task": "" }` was answered 400 with one issue per field, and no workspace was created.
- `/openapi.json` describes the request, the stream (`text/event-stream`, one schema per chunk) and the 400.
- `PORT=abc` stopped the server at startup with the variable named.
