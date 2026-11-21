# Spike findings (DEV-172)

Date: 2026-11-19. The spike code was thrown away; this note and the recordings in `fixtures/` are what it produced.

**Read this before** building the first slice (ticket 03: domain events, connectors and server app), the later slices
(10, 10c, 11), the sandbox adapter (13) and the deployment (14).

## Conditions

| Item        | Value                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------ |
| Machine     | macOS arm64, Node 22.21.1, pnpm 10.15.1                                                          |
| Claude Code | `@anthropic-ai/claude-agent-sdk` 0.3.328 (bundles Claude Code 2.1.328), model `claude-haiku-5-5` |
| Codex       | `@openai/codex-sdk` 0.170.0 (bundles Codex 0.170.0), model `gpt-6-luna`, reasoning effort low    |
| Credentials | The owner's Claude and ChatGPT **subscription logins**. No API key was available.                |
| Stream      | oRPC 1.16.4, AI SDK `ai` 7.0.177, `@ai-sdk/react`, Hono 4.13, `@scalar/hono-api-reference` 0.12  |
| Sandbox     | `@vercel/sandbox` 4.0.0, default image, Vercel Hobby plan                                        |

## Answers

| Question                                              | Answer                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| Do both agents run headless through their SDK?        | Yes.                                                         |
| Does `pnpm install` alone bring the agent binaries?   | Yes. No global install, no install script.                   |
| Do they run on a subscription login, with no API key? | Yes, locally. Not in a sandbox.                              |
| Can oRPC serve a stream that `useChat` renders?       | Yes. **The plain Hono fallback is not needed.**              |
| Is the stream documented in OpenAPI and Scalar?       | Yes, as `text/event-stream` with the schema of each event.   |
| Do both agents install and start in a Vercel Sandbox? | Yes. A full run there needs API keys: measured in ticket 13. |

## 1. The agents on a dev machine

### How they are called

Claude Code:

```ts
query({
  prompt: task,
  options: {
    cwd: workspace,
    env, // see "Credentials"
    model: 'haiku',
    settingSources: [], // ignore the machine's own Claude settings
    persistSession: false, // write no session file
    permissionMode: 'dontAsk',
    allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'WebSearch', 'WebFetch'],
    maxTurns: 15,
    abortController,
  },
});
```

Codex:

```ts
new Codex({ env })
  .startThread({
    workingDirectory: workspace,
    model: 'gpt-6-luna',
    modelReasoningEffort: 'low',
    sandboxMode: 'workspace-write',
    approvalPolicy: 'never',
    networkAccessEnabled: true,
    webSearchMode: 'live',
  })
  .runStreamed(task, { signal });
```

The workspace was an empty folder under the OS temp directory with `git init`. Codex refuses a folder that is not a
Git repository unless `skipGitRepoCheck` is set.

### Permissions for unattended runs

Neither agent needed its "bypass everything" mode.

- **Claude Code:** `permissionMode: 'dontAsk'` with an explicit `allowedTools` list. A tool outside the list is denied
  without a prompt.
- **Codex:** `approvalPolicy: 'never'` with `sandboxMode: 'workspace-write'`. Network access and web search are separate
  switches.

Claude Code still **lists** many tools the comparator does not want (subagents, scheduling, workflows, worktrees): 26
in the `init` event. `allowedTools` only pre-approves; to remove tools, the connector must also set `tools` or
`disallowedTools`. Not tested in the spike.

### Credentials

- With no API key in the environment, each SDK used the login already on the machine (`apiKeySource: "none"` in
  Claude Code's `init` event; `~/.codex/auth.json` for Codex).
- **An `ANTHROPIC_API_KEY` in the environment takes priority over the login.** The spike removed `ANTHROPIC_*`,
  `OPENAI_*`, `CODEX_*` and `CLAUDE*` variables from the environment given to the agents.
- Codex: when `env` is passed, the SDK does not inherit `process.env`, so `PATH` and `HOME` must be passed explicitly.
- A sandbox has no login: without a key, Claude Code answers "Not logged in" and Codex gets `401 Unauthorized`.

Rule for the `Config` port: use the API keys when they are set; otherwise fall back to the machine's login, which only
works in local mode.

### What each agent emits

The two streams have different grain. `RunEvent` in the domain must be the common shape.

| Concept       | Claude Code                                                                    | Codex                                                                |
| ------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Start         | `system` / `init` (model, tools, cwd, permission mode)                         | `thread.started`, then `turn.started`                                |
| Text          | `assistant` message with a `text` block                                        | `item.completed` with an `agent_message` item                        |
| Tool call     | `assistant` message with a `tool_use` block (`name`, `input`)                  | `item.started` then `item.completed`, one item type per tool         |
| Tool result   | `user` message with a `tool_result` block, plus a structured `tool_use_result` | The same item, completed (`aggregated_output`, `exit_code`)          |
| Shell command | `tool_use` named `Bash`                                                        | `command_execution` item                                             |
| File edit     | `tool_use` named `Write` or `Edit`; the result has a `structuredPatch`         | `file_change` item: paths and kind (add, update, delete), no content |
| Web search    | `tool_use` named `WebSearch`; results in the tool result                       | `web_search` item: query and results                                 |
| End           | `result` (cost, usage, turns, duration)                                        | `turn.completed` (token usage only)                                  |
| Noise to drop | `system` / `thinking_tokens`, `rate_limit_event`, `ToolSearch` tool calls      | `reasoning` and `todo_list` items (not seen, in the types)           |

A small task gave 26 to 38 events from Claude Code and 9 to 11 from Codex.

### File edits cannot be counted from events

- Codex wrote its files **through the shell** (`cat > file <<EOF`, a Python one-liner) in 2 runs of 3. Those runs have
  no `file_change` event. It emitted `file_change` only when the task said to use its patch tool
  (`fixtures/codex/patch.json`).
- Claude Code also tried `sed -i` once before using `Edit` (`fixtures/claude-code/edit.json`).

So: **"files changed" and the diffs come from the workspace (`git diff`), never from events.** File-edit events are a
live hint in the chat. A shell command that writes a file is shown as a shell command.

### Usage and cost

| Field    | Claude Code                                                                                | Codex                                                                              |
| -------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Cost     | `result.total_cost_usd`, an estimate at list prices, reported even on a subscription       | **Not reported**                                                                   |
| Tokens   | `result.modelUsage[model]`: input, output, cache read, cache creation, web search requests | `turn.completed.usage`: input, cached input, cache write, output, reasoning output |
| Turns    | `result.num_turns`                                                                         | Not reported                                                                       |
| Duration | `result.duration_ms`, `result.duration_api_ms`                                             | Not reported; measure it around the call                                           |

`result.usage` in Claude Code covers the main loop only; `modelUsage` is the one to read. Codex's cost needs a price
table per model, or stays empty.

Confirmed with API keys on 2026-11-21 (see "With API keys" below): the cost and usage fields are the same as on a
subscription.

### Failure and cancel

| Case        | Claude Code                                                                                                                                          | Codex                                                                                               |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Wrong model | A `result` event with `subtype: "success"`, `is_error: true`, `terminal_reason: "api_error"`, `api_error_status: 404`. Then the iterator **throws**. | An `error` event and `turn.failed`. Then the iterator **throws** ("Codex Exec exited with code 1"). |
| No login    | An assistant message from model `<synthetic>`, a `result`, then a throw: "Not logged in"                                                             | `error` events while it retries 10 times (about 13 s), `turn.failed`, then a throw                  |
| Cancel      | `abortController.abort()`: the iterator throws `Error("Claude Code process aborted by user")`                                                        | `signal`: the iterator throws an `AbortError`                                                       |

Both agents report a failure twice: as an event, then as a thrown error. A connector must catch the throw and return
one failed or cancelled result. Claude Code's `subtype: "success"` cannot be trusted alone; read `is_error`.

Not tested: how each agent reports hitting a rate limit.

### Durations (small tasks, small models)

| Task                                          | Claude Code (`claude-haiku-5-5`) | Codex (`gpt-6-luna`, low) |
| --------------------------------------------- | -------------------------------- | ------------------------- |
| Web search, write one file, run it            | 31 s, 6 turns, $0.030            | 19 s, 56 k input tokens   |
| Write two files, run tests, rename, run again | 19 s, 12 turns, $0.005           | 19 s, 74 k input tokens   |
| Start to first event                          | about 5 s                        | about 5.5 s               |

### Install size

Each SDK brings its binary as an optional dependency for the current platform: about 340 MB for Claude Code and
360 MB for Codex. A Vercel Function is limited to 250 MB. **The server function cannot bundle the agents**; in
production they live in the sandbox only.

## 2. The stream: oRPC, AI SDK, OpenAPI

A contract-first procedure whose output is `eventIterator(ChunkSchema)` works end to end.

- **Server:** the handler builds a stream with `createUIMessageStream` and returns `streamToEventIterator(stream)`.
- **Client:** a custom `ChatTransport` whose `sendMessages` returns
  `eventIteratorToUnproxiedDataStream(await client.runs.stream(input, { signal: abortSignal }))`.
  `reconnectToStream` returns `null`: resuming a stream is not supported.
- **Two columns:** two `useChat` hooks with different `id`s, one shared input sending to both. Each column has its own
  status and they stream at their own pace. `stop()` on both cancels both.
- **Typed parts:** a custom chunk `{ type: 'data-toolCall', id, data }` arrives as a typed message part. Sending the
  same `id` again **updates the part in place**: a tool call goes from running to done without a second entry.
- **Validation:** invalid input returns `400` with code `BAD_REQUEST` and the Zod issues.
- **Two wire formats from one contract:** `RPCHandler` on `/rpc/*` (for the web app) and `OpenAPIHandler` on `/api/*`
  (plain REST, `POST /api/runs`). Both answer with server-sent events.
- **OpenAPI:** the generated document describes the response as `text/event-stream` with a `oneOf` of the event
  shapes. Scalar shows the endpoint, the request body, a curl example and an example event.

Two points for the server app (ticket 03):

1. The chunk schema was written by hand as a Zod union of the AI SDK chunk shapes. The AI SDK exports
   `uiMessageChunkSchema`, but the contract needs its own narrower schema to document it.
2. Zod 4 needs the converter from `@orpc/zod/zod4`.

## 3. Vercel Sandbox

| Measure                           | Result                                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| Create a sandbox                  | 0.4 s                                                                                  |
| System                            | Linux x86_64, Node 24.22, npm 11, pnpm 11, user `ubuntu`, cwd `/vercel`                |
| `npm install` of both SDKs        | 19 s, 826 MB, with the `linux-x64` binaries                                            |
| Start Claude Code through its SDK | First event after 1.0 s                                                                |
| Start Codex through its SDK       | First event after 0.3 s                                                                |
| Read events from outside          | Yes: one JSON line per event on stdout, received live through `runCommand({ stdout })` |

- The default image **already contains** `claude` (2.1.325) and `codex` (0.169.0) at `/usr/local/bin`. Ticket 13 can
  point the SDKs at them (`pathToClaudeCodeExecutable`, `codexPathOverride`) or call them directly, and skip the 19 s
  install. Their versions are the image's, not ours.
- Sandboxes are persistent by default. Create them with `persistent: false` and stop them in a `finally`.
- Authentication: a Vercel project linked with `vercel link`, then `vercel env pull` writes a `VERCEL_OIDC_TOKEN` to
  `.env.local`. The token expires after 12 hours. On Vercel the token is provided automatically.
- Hobby limits: 4 vCPUs, 45 minutes per sandbox, default timeout 5 minutes.

Shape for ticket 13: a small runner script inside the sandbox calls the agent and prints events as JSON lines; the
server reads them from outside and feeds the same connector translators as in local mode.

## The fixtures

`fixtures/<agent>/<name>.json`: `{ agent, model, task, durationMs, thrown, events: [{ t, event }], diff }`. `t` is
milliseconds from the start; `event` is the raw SDK event; `diff` is `git diff` of the workspace at the end. The user
name and temp paths were replaced.

| File             | Claude Code                                   | Codex                                   |
| ---------------- | --------------------------------------------- | --------------------------------------- |
| `success.json`   | Web search, `Write`, `Bash`, result with cost | Web search, shell command, usage        |
| `edit.json`      | `Write`, `Bash`, `Grep`, `Read`, `Edit`       | Shell commands only: no file-edit event |
| `patch.json`     |                                               | `file_change` events (add, then update) |
| `bad-model.json` | Error result, then a throw                    | `error`, `turn.failed`, then a throw    |
| `abort.json`     | Cancelled after 9 s                           | Cancelled after 9 s                     |

## With API keys

Measured on 2026-11-21 (ticket 22), with an Anthropic key and an OpenAI key in `.env`. Everything before this
section ran on subscription logins.

| Question                                     | Answer                                                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Does Claude Code use the key?                | Yes. Its first message says `apiKeySource: ANTHROPIC_API_KEY`; with no key it says `none` and uses the login.   |
| Does Codex run on the key alone?             | Yes: it completes with the key and an empty home folder, where no login exists.                                 |
| And with neither?                            | OpenAI answers 401, "Missing bearer or basic authentication".                                                   |
| Are the usage fields the same as on a login? | Yes, for both. Codex also sends `cache_write_input_tokens` and `reasoning_output_tokens`, which we do not read. |
| Does Claude Code still report a cost?        | Yes, as on a login. Codex reports none in either case.                                                          |
| Does the whole app work on keys?             | Yes: `pnpm test:e2e:live` passes, and a run of each agent through the API ends with its totals.                 |
| Do the task check and the run review work?   | Yes: 32 of 32 and 24 of 24 on their sets, about 3.3 seconds per question, as on a login.                        |

A key takes over from the login as soon as it is set: the server gives each agent its own key, and nothing else of
its environment that could carry a credential.

One caution about where the keys are kept: a tool that watches the project folder can see `.env`, though git ignores
it. Keys for this project should be made for it, with a spending cap, or kept in a file outside the folder.

## Still to verify

- A full agent run inside a sandbox (ticket 24, with the API keys).
- Restricting Claude Code's tool list with `tools` or `disallowedTools`, and what each Codex switch does: first step of
  ticket 10b (DEV-199, tool access).
- Rate-limit events from both agents: parked ticket DEV-198 (rate limits).
