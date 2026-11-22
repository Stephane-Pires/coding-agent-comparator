'use client';

import { cn } from 'cn';

import type { Tool, ToolCall } from '@comparator/contracts';
import { MessageResponse } from '@comparator/ui/components/ai-elements/message';
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@comparator/ui/components/ai-elements/sources';
import { Terminal } from '@comparator/ui/components/ai-elements/terminal';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@comparator/ui/components/ui/collapsible';
import { ICONS } from '@comparator/ui/icons';

/** A call on its one line: its text, whether that text is code, and a word before it. */
interface ToolTitle {
  readonly text: string;
  readonly isCode: boolean;
  readonly before?: string;
}

/** The word and the tone of each status. Colour is never the only signal: the icon and the word say it too. */
export const TOOL_CALL_STATUSES: Record<ToolCall['status'], { label: string; tone: string }> = {
  running: { label: 'Running', tone: 'text-muted-foreground' },
  succeeded: { label: 'Done', tone: 'text-success' },
  failed: { label: 'Failed', tone: 'text-destructive' },
};

const CHANGES = { created: 'Created', modified: 'Modified', deleted: 'Deleted' } as const;

/** A diff as a code block of an agent's message, so it gets the same colours as the code the agents quote. */
function formatDiff(diff: string): string {
  // A fence longer than any run of backticks in the diff.
  const fence = '`'.repeat(Math.max(3, ...[...diff.matchAll(/`+/g)].map(([run]) => run.length + 1)));
  return `${fence}diff\n${diff}\n${fence}`;
}

/** What a call is shown as on its one line: what the agent ran, searched, edited or used. */
export function getTitle(tool: Tool): ToolTitle {
  switch (tool.type) {
    case 'command':
      return { text: tool.command, isCode: true };
    case 'file-edit':
      return { text: tool.path, isCode: true, before: CHANGES[tool.change] };
    case 'web-search':
      return { text: tool.query || 'Searching the web', isCode: false };
    case 'other':
      return { text: tool.input ? `${tool.name} ${tool.input}` : tool.name, isCode: false };
  }
}

function Status({ status }: { status: ToolCall['status'] }) {
  const { label, tone } = TOOL_CALL_STATUSES[status];
  const Icon = ICONS.toolCall[status];
  return (
    <span className={cn('flex shrink-0 items-center gap-1 text-xs', tone)}>
      <Icon aria-hidden="true" className={cn('size-4', status === 'running' && 'animate-spin')} />
      {label}
    </span>
  );
}

/**
 * One tool call of an agent, on one line: what it is, and whether it is done. A command or another tool opens to
 * show its full text and what it printed; a file edit, the change when the agent reported it; a web search lists
 * the pages it found.
 */
export function ToolCallRow({ call }: { call: ToolCall }) {
  const { tool, status, output } = call;
  const Icon = ICONS.tool[tool.type];
  const title = getTitle(tool);
  const line = (
    <>
      <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      {title.before ? <span className="shrink-0">{title.before}</span> : null}
      <span className={cn('min-w-0 flex-1 truncate text-left', title.isCode && 'font-mono text-xs')}>
        {title.text}
      </span>
      <Status status={status} />
    </>
  );

  if (tool.type === 'web-search') {
    return (
      <div className="flex flex-col gap-2 px-3 py-2 text-sm">
        <div className="flex items-center gap-2">{line}</div>
        {tool.sources.length > 0 ? (
          <Sources>
            <SourcesTrigger count={tool.sources.length} />
            <SourcesContent>
              {tool.sources.map((source) => (
                <Source key={source.url} href={source.url} title={source.title} />
              ))}
            </SourcesContent>
          </Sources>
        ) : null}
      </div>
    );
  }

  const isMultiline = tool.type === 'command' && tool.command.includes('\n');
  const diff = tool.type === 'file-edit' ? tool.diff : '';
  if (output === '' && !isMultiline && diff === '')
    return <div className="flex items-center gap-2 px-3 py-2 text-sm">{line}</div>;

  return (
    <Collapsible className="group text-sm">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent/50">
        {line}
        <ICONS.expand
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-(--duration-fast) group-data-[state=open]:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-2 px-3 pb-3">
        {isMultiline ? <Terminal output={tool.command} aria-label="Command" /> : null}
        {diff === '' ? null : <MessageResponse>{formatDiff(diff)}</MessageResponse>}
        {output === '' ? null : <Terminal output={output} isStreaming={status === 'running'} />}
      </CollapsibleContent>
    </Collapsible>
  );
}
