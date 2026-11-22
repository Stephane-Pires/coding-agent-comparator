import type { ThreadEvent, ThreadItem } from '@openai/codex-sdk';

import { countTokens, type AgentEvent, type ToolCall, type WebSource } from '@comparator/domain';

/** Codex runs every command through a login shell: `/bin/zsh -lc "<the command>"`. */
const SHELL_WRAPPER = /^\S*\b(?:zsh|bash|sh) -lc (['"])([\s\S]*)\1$/;

/** What each kind of file change does to a file, in the domain's words. */
const CHANGES = { add: 'created', update: 'modified', delete: 'deleted' } as const;

/** Where a command stands, in the domain's words. */
const COMMAND_STATUSES = {
  in_progress: 'running',
  completed: 'succeeded',
  failed: 'failed',
} as const satisfies Record<Extract<ThreadItem, { type: 'command_execution' }>['status'], ToolCall['status']>;

/** How an ended file change went, in the domain's words. */
const FILE_CHANGE_STATUSES = {
  completed: 'succeeded',
  failed: 'failed',
} as const satisfies Record<Extract<ThreadItem, { type: 'file_change' }>['status'], ToolCall['status']>;

/** The command the agent meant, without the shell that carried it. */
export function unwrapCommand(commandLine: string): string {
  const match = SHELL_WRAPPER.exec(commandLine);
  if (!match) return commandLine;
  const [, quote, quoted = ''] = match;
  // Undo the quoting of the outer shell: `\"` inside double quotes, `'\''` inside single quotes.
  return quote === '"' ? quoted.replaceAll(/\\(["\\$`])/g, '$1') : quoted.replaceAll(`'\\''`, `'`);
}

/** The pages of a web search. The SDK's types leave them out; the events carry `results: [{ title, url }]`. */
function getWebSources(item: object): WebSource[] {
  const results: unknown = 'results' in item ? item.results : undefined;
  if (!Array.isArray(results)) return [];
  return results.flatMap((page: unknown) =>
    typeof page === 'object' &&
    page !== null &&
    'title' in page &&
    'url' in page &&
    typeof page.title === 'string' &&
    typeof page.url === 'string'
      ? [{ title: page.title, url: page.url }]
      : [],
  );
}

/**
 * Codex ends its answers with links to the files it wrote, by their full path: `[main.mjs](/tmp/…/main.mjs)`.
 * The workspace is temporary, so such a link leads nowhere: it becomes the file's name, and any other mention of
 * the workspace's path is dropped. The files themselves are shown from the workspace.
 */
function removeWorkspacePath(text: string, workspacePath: string): string {
  const path = workspacePath.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const links = new RegExp(String.raw`\[([^\]]*)\]\(${path}/[^)]*\)`, 'g');
  return text
    .replaceAll(links, (_link, label: string) => `\`${label.replaceAll('`', '')}\``)
    .replaceAll(`${workspacePath}/`, '');
}

/** The tool calls of this item as they stand, or none for the items that are not tool calls. */
function getToolCalls(item: ThreadItem, isEnded: boolean, workspacePath: string): ToolCall[] {
  if (item.type === 'command_execution') {
    const status = COMMAND_STATUSES[item.status];
    return [
      {
        id: item.id,
        tool: { type: 'command', command: unwrapCommand(item.command) },
        status,
        output: item.aggregated_output,
      },
    ];
  }
  if (item.type === 'web_search') {
    const tool = { type: 'web-search' as const, query: item.query, sources: getWebSources(item) };
    return [{ id: item.id, tool, status: isEnded ? 'succeeded' : 'running', output: '' }];
  }
  if (item.type === 'file_change') {
    const status = isEnded ? FILE_CHANGE_STATUSES[item.status] : 'running';
    // One item can change several files: each is its own call. Codex gives the paths, not the content.
    return item.changes.map((change) => ({
      id: `${item.id}:${change.path}`,
      tool: {
        type: 'file-edit',
        path: change.path.replace(`${workspacePath}/`, ''),
        change: CHANGES[change.kind],
        diff: '',
      },
      status,
      output: '',
    }));
  }
  return [];
}

/**
 * Translates one event of Codex's stream into run events. Pure: no state between events, because Codex reports
 * a tool call whole each time, when it starts and when it ends.
 *
 * Dropped: reasoning, to-do lists and warnings; and the top-level `error` event, which Codex emits while it
 * retries (`turn.failed` has the last word).
 */
export function translate(event: ThreadEvent, workspacePath: string): AgentEvent[] {
  switch (event.type) {
    case 'item.started':
    case 'item.updated':
    case 'item.completed': {
      const isEnded = event.type === 'item.completed';
      if (event.item.type === 'agent_message')
        return isEnded && event.item.text.trim() !== ''
          ? [{ kind: 'message', text: removeWorkspacePath(event.item.text, workspacePath) }]
          : [];
      return getToolCalls(event.item, isEnded, workspacePath).map((call) => ({ kind: 'tool-call', call }));
    }
    case 'turn.completed': {
      // Codex includes cached input in `input_tokens`, and reports no cost.
      const { input_tokens, cached_input_tokens, output_tokens } = event.usage;
      const tokens = countTokens({
        uncachedInput: input_tokens - cached_input_tokens,
        cachedInput: cached_input_tokens,
        output: output_tokens,
      });
      return [
        { kind: 'usage', usage: { ...tokens, costUsd: null } },
        { kind: 'finished', outcome: { status: 'succeeded' } },
      ];
    }
    case 'turn.failed':
      return [{ kind: 'finished', outcome: { status: 'failed', reason: event.error.message } }];
    default:
      return [];
  }
}
