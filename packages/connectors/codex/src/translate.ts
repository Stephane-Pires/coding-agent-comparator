import type { ThreadEvent, ThreadItem } from '@openai/codex-sdk';

import type { RunEvent, ToolCall, WebSource } from '@comparator/domain';

/** Codex runs every command through a login shell: `/bin/zsh -lc "<the command>"`. */
const SHELL_WRAPPER = /^\S*\b(?:zsh|bash|sh) -lc (['"])([\s\S]*)\1$/;

/** The command the agent meant, without the shell that carried it. */
export function unwrapCommand(commandLine: string): string {
  const match = SHELL_WRAPPER.exec(commandLine);
  if (!match) return commandLine;
  const [, quote, quoted = ''] = match;
  // Undo the quoting of the outer shell: `\"` inside double quotes, `'\''` inside single quotes.
  return quote === '"' ? quoted.replaceAll(/\\(["\\$`])/g, '$1') : quoted.replaceAll(`'\\''`, `'`);
}

/** The pages of a web search. The SDK's types leave them out; the events carry `results: [{ title, url }]`. */
function webSources(item: object): WebSource[] {
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

const CHANGES = { add: 'created', update: 'modified', delete: 'deleted' } as const;

/**
 * Codex ends its answers with links to the files it wrote, by their full path: `[main.mjs](/tmp/…/main.mjs)`.
 * The workspace is temporary, so such a link leads nowhere: it becomes the file's name, and any other mention of
 * the workspace's path is dropped. The files themselves are shown from the workspace.
 */
function withoutWorkspace(text: string, workspacePath: string): string {
  const path = workspacePath.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const links = new RegExp(String.raw`\[([^\]]*)\]\(${path}/[^)]*\)`, 'g');
  return text
    .replaceAll(links, (_link, label: string) => `\`${label.replaceAll('`', '')}\``)
    .replaceAll(`${workspacePath}/`, '');
}

/** The tool calls of this item as they stand, or none for the items that are not tool calls. */
function toolCalls(item: ThreadItem, ended: boolean, workspacePath: string): ToolCall[] {
  if (item.type === 'command_execution') {
    const status =
      item.status === 'in_progress' ? 'running' : item.status === 'completed' ? 'succeeded' : 'failed';
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
    const tool = { type: 'web-search' as const, query: item.query, sources: webSources(item) };
    return [{ id: item.id, tool, status: ended ? 'succeeded' : 'running', output: '' }];
  }
  if (item.type === 'file_change') {
    const status = !ended ? 'running' : item.status === 'failed' ? 'failed' : 'succeeded';
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
export function translate(event: ThreadEvent, workspacePath: string): RunEvent[] {
  switch (event.type) {
    case 'item.started':
    case 'item.updated':
    case 'item.completed': {
      const ended = event.type === 'item.completed';
      if (event.item.type === 'agent_message')
        return ended && event.item.text.trim() !== ''
          ? [{ kind: 'message', text: withoutWorkspace(event.item.text, workspacePath) }]
          : [];
      return toolCalls(event.item, ended, workspacePath).map((call) => ({ kind: 'tool-call', call }));
    }
    case 'turn.completed':
      return [{ kind: 'finished', outcome: { status: 'succeeded' } }];
    case 'turn.failed':
      return [{ kind: 'finished', outcome: { status: 'failed', reason: event.error.message } }];
    default:
      return [];
  }
}
