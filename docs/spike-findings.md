# What the agents do: findings

Measured on 2026-11-19 to 2026-11-21, with `@anthropic-ai/claude-agent-sdk` 0.3.328 (Claude Code 2.1.328, model
`claude-haiku-5-5`) and `@openai/codex-sdk` 0.170.0 (Codex 0.170.0, model `gpt-6-luna`, low reasoning effort), on
macOS with Node 22, first on subscription logins, then on API keys. The connectors are written against what follows;
the recordings in `fixtures/` are the evidence.

## Install

Each SDK brings its agent's binary for the current platform: about 340 MB for Claude Code and 360 MB for Codex.
`pnpm install` alone is enough. A Vercel Function holds 250 MB at most, so the hosted API cannot carry the agents:
in production they run in a Vercel Sandbox.

## Unattended runs

Neither agent needs its "bypass everything" mode.

- **Claude Code:** `permissionMode: 'dontAsk'` with an explicit list of allowed tools. A tool outside the list is
  denied without a prompt. The list only pre-approves: Claude Code still announces its other tools.
- **Codex:** `approvalPolicy: 'never'` with its own sandbox in `workspace-write`. Network access and web search are
  separate switches. It refuses a folder that is not a git repository unless told to skip the check.

## Credentials

- With no key in the environment, each agent uses the login already on the machine. **A key in the environment
  takes priority over the login.** Each agent is given its own key and nothing else of the server's environment
  that could carry a credential.
- Claude Code says which it used in its first event (`apiKeySource`). Codex says nothing; with neither a key nor a
  login, OpenAI answers 401.
- Codex's SDK does not inherit the environment when one is given: `PATH` and `HOME` must be passed.
- A sandbox has no login: there, both agents need their keys.

## What each agent emits

| Concept       | Claude Code                                                      | Codex                                                       |
| ------------- | ---------------------------------------------------------------- | ----------------------------------------------------------- |
| Start         | `system` / `init` (model, tools, working folder)                 | `thread.started`, then `turn.started`                       |
| Text          | `assistant` message with a `text` block                          | `item.completed` with an `agent_message` item               |
| Tool call     | `assistant` message with a `tool_use` block                      | `item.started`, then `item.completed`, one type per tool    |
| Tool result   | `user` message with a `tool_result` block, and `tool_use_result` | The same item, completed (`aggregated_output`, `exit_code`) |
| Shell command | `tool_use` named `Bash`                                          | `command_execution` item                                    |
| File edit     | `tool_use` named `Write` or `Edit`; the result has the patch     | `file_change` item: paths and kind, no content              |
| Web search    | `tool_use` named `WebSearch`                                     | `web_search` item                                           |
| End           | `result` (cost, usage, turns, duration)                          | `turn.completed` (token usage only)                         |
| Ignored       | `thinking_tokens`, `rate_limit_event`, `ToolSearch` calls        | `reasoning` and `todo_list` items                           |

A small task gives 26 to 38 events from Claude Code and 9 to 11 from Codex.

**Files cannot be counted from events.** Codex wrote its files through the shell (`cat > file <<EOF`) in two runs of
three, with no `file_change` event; Claude Code once used `sed -i`. So the files a run left are read from its
workspace, after each tool call and at the end. A file-edit event is shown as a tool call, nothing more.

## Usage and cost

| Field    | Claude Code                                                   | Codex                                                    |
| -------- | ------------------------------------------------------------- | -------------------------------------------------------- |
| Cost     | `total_cost_usd`, an estimate at list prices, also on a login | **Not reported**                                         |
| Tokens   | `modelUsage[model]`: input, output, cache read and creation   | `usage`: input, cached input, output (and two we ignore) |
| Duration | Reported                                                      | Not reported: measured around the call                   |

`result.usage` in Claude Code covers the main loop only; `modelUsage` is the one read. The fields are the same on a
key and on a login.

## Failure and cancel

| Case        | Claude Code                                                                         | Codex                                                  |
| ----------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Wrong model | A `result` with `subtype: "success"` but `is_error: true`, then the iterator throws | An `error` event and `turn.failed`, then a throw       |
| No login    | A message from model `<synthetic>`, a `result`, then a throw: "Not logged in"       | `error` events for about 13 s of retries, then a throw |
| Cancel      | The iterator throws "Claude Code process aborted by user"                           | The iterator throws an `AbortError`                    |

Both report a failure twice, as an event and as a thrown error: a connector catches the throw and ends the run
once. Claude Code's `subtype: "success"` cannot be trusted alone; `is_error` decides.

## In a Vercel Sandbox

- The default image already contains `claude` (2.1.325) and `codex` (0.169.0). They are started by their own command
  (`claude --print … --output-format stream-json`, `codex exec --json`), which prints the SDKs' events one per line:
  the same translators read them. Their versions are the image's, not the lockfile's.
- A sandbox is created in 0.3 s; the first event comes at 1.6 s.
- **Codex's inner sandbox cannot start there** (a `bwrap` error on every command): it runs with
  `--sandbox danger-full-access`, the Vercel Sandbox being the isolation.
- Sandboxes are persistent by default: they are created with `persistent: false` and stopped in a `finally`.
- Outside Vercel, `vercel env pull` writes a `VERCEL_OIDC_TOKEN` that lasts 12 hours. The Vercel command line cannot
  link a project from inside a git worktree.

## The fixtures

`fixtures/<agent>/<name>.json` holds one real run: the task, and `events`, each with the raw SDK event. The user name
and temporary paths were replaced.

| File             | Claude Code                                   | Codex                                   |
| ---------------- | --------------------------------------------- | --------------------------------------- |
| `success.json`   | Web search, `Write`, `Bash`, result with cost | Web search, shell command, usage        |
| `edit.json`      | `Write`, `Bash`, `Grep`, `Read`, `Edit`       | Shell commands only: no file-edit event |
| `patch.json`     |                                               | `file_change` events (add, then update) |
| `bad-model.json` | Error result, then a throw                    | `error`, `turn.failed`, then a throw    |
| `abort.json`     | Cancelled after 9 s                           | Cancelled after 9 s                     |
