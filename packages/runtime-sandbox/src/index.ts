import { Sandbox } from '@vercel/sandbox';
import { ResultAsync } from 'neverthrow';

import type { CodingAgent, Workspace, WorkspaceProvider } from '@comparator/application';
import type { AgentEvent, AgentId, WorkspaceFile } from '@comparator/domain';

/**
 * An agent as a program that is started by a command and prints one JSON event per line. A connector describes its
 * agent this way; this adapter is what runs the command, in a sandbox.
 */
export interface CommandLineAgent {
  /** The command that runs the agent on a task. It is started in the workspace folder. */
  readonly command: (task: string) => {
    readonly cmd: string;
    readonly args: readonly string[];
    /** What the agent needs from its environment: its API key, and nothing of ours. */
    readonly env: Readonly<Record<string, string>>;
  };
  /** For one run in the folder `workspacePath`: the events known before the agent prints, and how to read a line. */
  readonly start: (workspacePath: string) => {
    readonly first: readonly AgentEvent[];
    readonly translate: (line: unknown) => readonly AgentEvent[];
  };
}

/** What this adapter uses of a sandbox: enough to stand in for one in a test. */
export interface SandboxLike {
  runCommand(command: string, args?: string[]): Promise<{ stdout(): Promise<string> }>;
  runCommand(params: {
    cmd: string;
    args: string[];
    cwd: string;
    env: Record<string, string>;
    detached: true;
    signal: AbortSignal;
  }): Promise<{
    logs(opts?: { signal?: AbortSignal }): AsyncIterable<{ stream: 'stdout' | 'stderr'; data: string }>;
    wait(): Promise<{ exitCode: number }>;
  }>;
  stop(): Promise<unknown>;
}

export interface SandboxOptions {
  /** The longest a run may take. A hosted API cannot hold a request for ever: the run ends before it is cut. */
  readonly runLimitMs: number;
  /** Creates a sandbox that lives at most `timeoutMs`. Replaced in tests. */
  readonly createSandbox?: (timeoutMs: number) => Promise<SandboxLike>;
}

/** Where an agent works inside its sandbox. */
const WORKSPACE_PATH = '/tmp/workspace';
/** Folders an agent fills with what it did not write, as in the local workspace. */
const SKIPPED = ['node_modules', '.git'];

/**
 * Lists the files of the workspace, from inside the sandbox: one JSON line, each file with its content in base64 so
 * that any byte travels. Links are left out: one could point outside the folder.
 */
const LIST_FILES = `
const fs = require('node:fs'), path = require('node:path');
const root = process.argv[1], skipped = new Set(${JSON.stringify(SKIPPED)}), files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!skipped.has(entry.name)) walk(full); }
    else if (entry.isFile()) files.push({ path: path.relative(root, full), content: fs.readFileSync(full).toString('base64') });
  }
})(root);
process.stdout.write(JSON.stringify(files));
`;

const realSandbox = async (timeoutMs: number): Promise<SandboxLike> =>
  // Not kept after it stops: a run's machine is thrown away with the run.
  Sandbox.create({ timeout: timeoutMs, persistent: false });

/**
 * Agents that each run in a Vercel Sandbox of their own: a machine created for the run and destroyed after it.
 * This adapter never runs an agent itself. It sends the sandbox the agent's command, reads what the agent prints
 * as it prints it, asks the sandbox for the files, and stops it.
 *
 * A workspace here is a sandbox, so the agents and the workspaces come together: they share the sandboxes.
 */
export function sandboxRuntime(
  agents: Readonly<Record<AgentId, CommandLineAgent>>,
  { runLimitMs, createSandbox = realSandbox }: SandboxOptions,
): { readonly agents: Readonly<Record<AgentId, CodingAgent>>; readonly workspaces: WorkspaceProvider } {
  // The sandbox behind each workspace handed out, for as long as that workspace is in use.
  const sandboxes = new WeakMap<Workspace, SandboxLike>();
  const sandboxOf = (workspace: Workspace): SandboxLike => {
    const sandbox = sandboxes.get(workspace);
    if (!sandbox) throw new Error('This workspace is not a sandbox of this runtime.');
    return sandbox;
  };

  const agent = (cli: CommandLineAgent): CodingAgent => ({
    async *run({ task, workspace, signal }) {
      const sandbox = sandboxOf(workspace);
      const limit = AbortSignal.timeout(runLimitMs);
      const stopped = AbortSignal.any([signal, limit]);
      const { cmd, args, env } = cli.command(task);
      const { first, translate } = cli.start(workspace.path);
      yield* first;
      let errors = '';
      try {
        const command = await sandbox.runCommand({
          cmd,
          args: [...args],
          cwd: workspace.path,
          env: { ...env },
          detached: true,
          signal: stopped,
        });
        // Output arrives in pieces that do not end on a line: a line is read once it is whole.
        let pending = '';
        for await (const log of command.logs({ signal: stopped })) {
          if (log.stream === 'stderr') {
            errors += log.data;
            continue;
          }
          const lines = (pending + log.data).split('\n');
          pending = lines.pop() ?? '';
          for (const line of lines) yield* read(line, translate);
        }
        yield* read(pending, translate);
        const { exitCode } = await command.wait();
        // An agent that ended its run has said so in an event. One that only exited says why on its error output.
        if (exitCode !== 0)
          throw new Error(errors.trim().slice(-500) || `The agent exited with code ${exitCode}.`);
      } catch (error) {
        if (limit.aborted && !signal.aborted)
          throw new Error(
            `The run was stopped after ${Math.round(runLimitMs / 1000)} seconds, the longest a run may last on the hosted app. Send a smaller task, or run the app on your own machine, where a run has no limit.`,
            { cause: error },
          );
        throw error;
      }
    },
  });

  return {
    agents: { 'claude-code': agent(agents['claude-code']), codex: agent(agents.codex) },
    workspaces: {
      create: () =>
        ResultAsync.fromPromise(
          (async () => {
            // The sandbox outlives the run's limit a little, so that its files can still be read after a cut.
            const sandbox = await createSandbox(runLimitMs + 60_000);
            await sandbox.runCommand('mkdir', ['-p', WORKSPACE_PATH]);
            const workspace: Workspace = { path: WORKSPACE_PATH };
            sandboxes.set(workspace, sandbox);
            return workspace;
          })(),
          (error) => ({
            kind: 'workspace-unavailable' as const,
            reason: `Could not create a sandbox: ${error instanceof Error ? error.message : String(error)}`,
          }),
        ),
      async read(workspace) {
        try {
          const listed = await sandboxOf(workspace).runCommand('node', ['-e', LIST_FILES, workspace.path]);
          return filesOf(await listed.stdout());
        } catch {
          // A sandbox that is gone or does not answer has no files to show: the run goes on.
          return [];
        }
      },
      async dispose(workspace) {
        const sandbox = sandboxes.get(workspace);
        sandboxes.delete(workspace);
        await sandbox?.stop().catch(() => undefined);
      },
    },
  };
}

/** The events of one printed line. A line that is not JSON is not an event: agents also print notices. */
function* read(line: string, translate: (line: unknown) => readonly AgentEvent[]): Generator<AgentEvent> {
  if (line.trim() === '') return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return;
  }
  yield* translate(parsed);
}

/** The files a sandbox listed, as the domain describes them: a file with a zero byte is binary, and not shown. */
function filesOf(listing: string): WorkspaceFile[] {
  const listed: unknown = JSON.parse(listing);
  if (!Array.isArray(listed)) return [];
  return listed
    .flatMap((entry: unknown): WorkspaceFile[] => {
      if (typeof entry !== 'object' || entry === null || !('path' in entry) || !('content' in entry))
        return [];
      const { path, content } = entry;
      if (typeof path !== 'string' || typeof content !== 'string') return [];
      const bytes = Buffer.from(content, 'base64');
      return bytes.includes(0)
        ? [{ path, content: '', state: 'binary' }]
        : [{ path, content: bytes.toString('utf8'), state: 'complete' }];
    })
    .toSorted((a, b) => a.path.localeCompare(b.path));
}
