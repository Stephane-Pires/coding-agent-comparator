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

/** A tool call as it stands in this item, or nothing for the items that are not tool calls. */
function toolCall(item: ThreadItem, ended: boolean): ToolCall | undefined {
  if (item.type === 'command_execution') {
    const status =
      item.status === 'in_progress' ? 'running' : item.status === 'completed' ? 'succeeded' : 'failed';
    return {
      id: item.id,
      tool: { type: 'command', command: unwrapCommand(item.command) },
      status,
      output: item.aggregated_output,
    };
  }
  if (item.type === 'web_search') {
    const tool = { type: 'web-search' as const, query: item.query, sources: webSources(item) };
    return { id: item.id, tool, status: ended ? 'succeeded' : 'running', output: '' };
  }
  return undefined;
}

/**
 * Translates one event of Codex's stream into run events. Pure: no state between events, because Codex reports
 * a tool call whole each time, when it starts and when it ends.
 *
 * Dropped: reasoning, to-do lists and warnings; file changes, which this slice does not show yet; and the
 * top-level `error` event, which Codex emits while it retries (`turn.failed` has the last word).
 */
export function translate(event: ThreadEvent): RunEvent[] {
  switch (event.type) {
    case 'item.started':
    case 'item.updated':
    case 'item.completed': {
      const ended = event.type === 'item.completed';
      if (event.item.type === 'agent_message')
        return ended && event.item.text.trim() !== '' ? [{ kind: 'message', text: event.item.text }] : [];
      const call = toolCall(event.item, ended);
      return call ? [{ kind: 'tool-call', call }] : [];
    }
    case 'turn.completed':
      return [{ kind: 'finished', outcome: { status: 'succeeded' } }];
    case 'turn.failed':
      return [{ kind: 'finished', outcome: { status: 'failed', reason: event.error.message } }];
    default:
      return [];
  }
}
