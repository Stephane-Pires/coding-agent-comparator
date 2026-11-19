import type { AgentId, RunStatus, ToolCall } from '@comparator/contracts';
import { AGENT_LABELS } from '@comparator/ui/agents';
import { Message, MessageContent, MessageResponse } from '@comparator/ui/components/ai-elements/message';
import { RunStatusBadge } from '@comparator/ui/components/run-status-badge';
import { ToolCallRow } from '@comparator/ui/components/tool-call-row';
import { ICONS } from '@comparator/ui/icons';

/** One thing an agent said or did, in the order it happened. */
export type RunItem =
  | { readonly type: 'message'; readonly id: string; readonly text: string }
  | { readonly type: 'tool-call'; readonly call: ToolCall };

export interface RunColumnProps {
  readonly agent: AgentId;
  readonly status: RunStatus;
  /** What the agent said and did so far, in order. */
  readonly items: readonly RunItem[];
  /** Why the run failed, in the agent's own words. */
  readonly failureReason?: string | undefined;
}

type Block =
  | { type: 'message'; id: string; text: string }
  | { type: 'tool-calls'; id: string; calls: ToolCall[] };

/** Tool calls that follow each other form one block, so a long run reads as a few groups and not a hundred rows. */
function blocksOf(items: readonly RunItem[]): Block[] {
  const blocks: Block[] = [];
  for (const item of items) {
    const last = blocks.at(-1);
    if (item.type === 'message') blocks.push(item);
    else if (last?.type === 'tool-calls') last.calls.push(item.call);
    else blocks.push({ type: 'tool-calls', id: item.call.id, calls: [item.call] });
  }
  return blocks;
}

/** One agent's run: who it is, where the run stands, and what the agent said and did. */
export function RunColumn({ agent, status, items, failureReason }: RunColumnProps) {
  const Icon = ICONS.agent[agent];
  const label = AGENT_LABELS[agent];
  return (
    <section aria-label={label} className="flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4">
      <header className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-lg font-medium">
          <Icon aria-hidden="true" className="size-4" />
          {label}
        </h3>
        <RunStatusBadge status={status} />
      </header>
      {blocksOf(items).map((block) =>
        block.type === 'message' ? (
          <Message key={block.id} from="assistant">
            <MessageContent>
              <MessageResponse isAnimating={status === 'running'}>{block.text}</MessageResponse>
            </MessageContent>
          </Message>
        ) : (
          <div key={block.id} className="divide-y overflow-hidden rounded-md border">
            {block.calls.map((call) => (
              <ToolCallRow key={call.id} call={call} />
            ))}
          </div>
        ),
      )}
      {status === 'failed' && failureReason ? (
        <p className="text-sm text-destructive">{failureReason}</p>
      ) : null}
    </section>
  );
}
