import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';

import type { RunEvent, Tool, ToolCall, WebSource } from '@comparator/domain';

/** The model name Claude Code gives to notices it writes itself, such as "Not logged in". */
const SYNTHETIC_MODEL = '<synthetic>';
/** Claude Code looking up its own tools: housekeeping, not something the agent did for the task. */
const HIDDEN_TOOLS = new Set(['ToolSearch']);
/** The fields that say what a tool was pointed at, in the order they are looked for. */
const INPUT_SUBJECTS = ['file_path', 'path', 'pattern', 'url', 'query'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');

/** The text of a tool result: a string, or a list of blocks whose text parts are joined. */
function resultText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .flatMap((block) => (isRecord(block) && block['type'] === 'text' ? [textOf(block['text'])] : []))
    .join('\n');
}

/** The pages of a web search, read from the structured result: `{ results: [{ content: [{ title, url }] }] }`. */
function webSources(structured: unknown): WebSource[] {
  if (!isRecord(structured) || !Array.isArray(structured['results'])) return [];
  return structured['results']
    .flatMap((result: unknown) =>
      isRecord(result) && Array.isArray(result['content']) ? result['content'] : [],
    )
    .flatMap((page: unknown) =>
      isRecord(page) && typeof page['title'] === 'string' && typeof page['url'] === 'string'
        ? [{ title: page['title'], url: page['url'] }]
        : [],
    );
}

const toolCall = (call: ToolCall): RunEvent => ({ kind: 'tool-call', call });

/**
 * Translates Claude Code's stream into run events, for one run.
 *
 * Claude Code reports a tool call in two halves that share only an id: the call, then its result, which does not
 * say what was called. The translator remembers the calls still running, so that each result becomes a complete
 * tool call. Everything else translates with no memory.
 *
 * Paths inside `workspacePath` are shown relative to it: the folder is temporary and its name means nothing.
 */
export function createTranslator(workspacePath: string): (message: SDKMessage) => RunEvent[] {
  const running = new Map<string, Tool>();
  const relative = (text: string) => text.replaceAll(`${workspacePath}/`, '');

  const toolOf = (name: string, input: unknown): Tool => {
    const fields = isRecord(input) ? input : {};
    if (name === 'Bash') return { type: 'command', command: relative(textOf(fields['command'])) };
    if (name === 'WebSearch') return { type: 'web-search', query: textOf(fields['query']), sources: [] };
    const subject = INPUT_SUBJECTS.map((key) => fields[key]).find((value) => typeof value === 'string');
    return { type: 'other', name, input: relative(textOf(subject) || JSON.stringify(fields)) };
  };

  return (message) => {
    if (message.type === 'assistant') {
      // A synthetic notice announces a failure: the `result` that follows carries the same text.
      if (message.message.model === SYNTHETIC_MODEL) return [];
      return message.message.content.flatMap((block): RunEvent[] => {
        if (block.type === 'text')
          return block.text.trim() === '' ? [] : [{ kind: 'message', text: block.text }];
        if (block.type !== 'tool_use' || HIDDEN_TOOLS.has(block.name)) return [];
        const tool = toolOf(block.name, block.input);
        running.set(block.id, tool);
        return [toolCall({ id: block.id, tool, status: 'running', output: '' })];
      });
    }
    if (message.type === 'user') {
      const { content } = message.message;
      if (typeof content === 'string') return [];
      return content.flatMap((block): RunEvent[] => {
        if (block.type !== 'tool_result') return [];
        const tool = running.get(block.tool_use_id);
        if (!tool) return [];
        running.delete(block.tool_use_id);
        const status = block.is_error ? 'failed' : 'succeeded';
        // A search's result text is a dump of its links: the links are shown as sources instead.
        return tool.type === 'web-search'
          ? [
              toolCall({
                id: block.tool_use_id,
                tool: { ...tool, sources: webSources(message.tool_use_result) },
                status,
                output: '',
              }),
            ]
          : [toolCall({ id: block.tool_use_id, tool, status, output: resultText(block.content) })];
      });
    }
    if (message.type === 'result') {
      // `subtype: 'success'` cannot be trusted alone: a refused model is a "success" with `is_error`.
      if (!message.is_error) return [{ kind: 'finished', outcome: { status: 'succeeded' } }];
      const reason = message.subtype === 'success' ? message.result : message.errors.join('\n');
      return [{ kind: 'finished', outcome: { status: 'failed', reason: reason || message.subtype } }];
    }
    return [];
  };
}
