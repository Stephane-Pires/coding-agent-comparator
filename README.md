# Coding Agent Comparator

Send the same task to two coding agents (Claude Code and Codex) and compare, in a web app, how each one performed.

Work in progress. Run instructions and sample prompts will be added here as the project is built.

## What you need to run it

### On the machine

| Tool       | Version                              | Why                                                                | Provided by                                              |
| ---------- | ------------------------------------ | ------------------------------------------------------------------ | -------------------------------------------------------- |
| Node.js    | 22.18 or later (also 24.11+, or 26+) | Runs the API directly from TypeScript, the web app and the tooling | You                                                      |
| pnpm       | 10.15.1                              | Installs the workspace and starts everything                       | You: `npm install -g pnpm`                               |
| Git        | Any recent                           | To clone the repository                                            | You                                                      |
| A browser  | Any modern one                       | To use the app                                                     | You                                                      |
| Free ports | 3100 and 3001                        | The web app and the API                                            | 3100 is fixed; the API's port can be changed with `PORT` |
| Disk       | About 1.7 GB                         | The installed packages, of which about 700 MB are the two agents   |                                                          |

The two agents are not installed separately: `pnpm install` brings Claude Code and Codex with their SDKs.

### Access

| What                                                                                      | Why                                            | Required?      |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------- | -------------- |
| Anthropic access: an API key (`ANTHROPIC_API_KEY`), or a Claude Code login on the machine | Claude Code, the task check and the run review | One of the two |
| OpenAI access: an API key (`OPENAI_API_KEY`), or a Codex login on the machine             | Codex                                          | One of the two |
| Network to the Anthropic and OpenAI APIs                                                  | The agents call their providers                | Yes            |
| Network to the npm registry                                                               | The first `pnpm install`                       | Once           |

No database, no Docker and no other service.
