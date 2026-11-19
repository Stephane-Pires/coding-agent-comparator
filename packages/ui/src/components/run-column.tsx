import type { AgentId, RunStatus } from '@comparator/contracts';
import { AGENT_LABELS } from '@comparator/ui/agents';
import { Message, MessageContent, MessageResponse } from '@comparator/ui/components/ai-elements/message';
import { RunStatusBadge } from '@comparator/ui/components/run-status-badge';
import { ICONS } from '@comparator/ui/icons';

export interface RunColumnProps {
  readonly agent: AgentId;
  readonly status: RunStatus;
  /** What the agent said so far, in order. */
  readonly messages: readonly { readonly id: string; readonly text: string }[];
  /** Why the run failed, in the agent's own words. */
  readonly failureReason?: string | undefined;
}

/** One agent's run: who it is, where the run stands, and what the agent said. */
export function RunColumn({ agent, status, messages, failureReason }: RunColumnProps) {
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
      {messages.map((message) => (
        <Message key={message.id} from="assistant">
          <MessageContent>
            <MessageResponse isAnimating={status === 'running'}>{message.text}</MessageResponse>
          </MessageContent>
        </Message>
      ))}
      {status === 'failed' && failureReason ? (
        <p className="text-sm text-destructive">{failureReason}</p>
      ) : null}
    </section>
  );
}
