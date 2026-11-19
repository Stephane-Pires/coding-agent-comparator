import type { ReactNode } from 'react';

import type { AgentId, Metrics, RunStatus } from '@comparator/contracts';
import { AGENT_LABELS } from '@comparator/ui/agents';
import { RunStatusBadge } from '@comparator/ui/components/run-status-badge';
import { ICONS } from '@comparator/ui/icons';

/** How one agent's run ended, and its totals: none when the run was cancelled or never reached the API. */
export interface RunResult {
  readonly agent: AgentId;
  readonly status: RunStatus;
  readonly metrics?: Metrics | undefined;
}

const integer = new Intl.NumberFormat('en-US');
const seconds = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

const NOT_REPORTED = <span className="text-muted-foreground">Not reported</span>;

function inputTokens({ usage }: Metrics): ReactNode {
  if (!usage) return NOT_REPORTED;
  const cached =
    usage.inputTokens === 0 ? 0 : Math.round((usage.cachedInputTokens / usage.inputTokens) * 100);
  return (
    <>
      {integer.format(usage.inputTokens)} <span className="text-muted-foreground">({cached}% cached)</span>
    </>
  );
}

/** The rows, in the order they are read. Tokens and cost are the agent's own report; the rest is measured. */
const ROWS: readonly { label: string; value: (metrics: Metrics) => ReactNode }[] = [
  { label: 'Duration', value: (metrics) => `${seconds.format(metrics.durationMs / 1000)} s` },
  { label: 'Input tokens', value: inputTokens },
  {
    label: 'Output tokens',
    value: ({ usage }) => (usage ? integer.format(usage.outputTokens) : NOT_REPORTED),
  },
  {
    label: 'API cost',
    value: ({ usage }) =>
      usage?.costUsd === null || usage?.costUsd === undefined ? NOT_REPORTED : dollars.format(usage.costUsd),
  },
  { label: 'Tool calls', value: (metrics) => integer.format(metrics.toolCalls) },
  { label: 'Files', value: (metrics) => integer.format(metrics.files) },
];

/**
 * The agent that was fastest, when at least two runs succeeded. Duration is the only value marked as better: tokens
 * come from different tokenizers, cost is not reported by every agent, and more tool calls or files is neither
 * better nor worse.
 */
function fastestOf(runs: readonly RunResult[]): AgentId | undefined {
  const done = runs.flatMap(({ agent, status, metrics }) =>
    status === 'succeeded' && metrics ? [{ agent, durationMs: metrics.durationMs }] : [],
  );
  if (done.length < 2) return undefined;
  return done.reduce((best, run) => (run.durationMs < best.durationMs ? run : best)).agent;
}

/** The runs of one comparison in numbers: one row per metric, one column per agent. */
export function ComparisonMetrics({ runs }: { runs: readonly RunResult[] }) {
  const fastest = fastestOf(runs);
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">The runs in numbers</caption>
        <thead>
          <tr className="border-b">
            <td className="px-4 py-3" />
            {runs.map(({ agent, status }) => {
              const Icon = ICONS.agent[agent];
              return (
                <th key={agent} scope="col" className="px-4 py-3 font-medium">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="flex items-center gap-2">
                      <Icon aria-hidden="true" className="size-4" />
                      {AGENT_LABELS[agent]}
                    </span>
                    <RunStatusBadge status={status} className="text-xs font-normal" />
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y">
          {ROWS.map(({ label, value }) => (
            <tr key={label}>
              <th scope="row" className="px-4 py-2 font-normal text-muted-foreground">
                {label}
              </th>
              {runs.map(({ agent, metrics }) => (
                <td key={agent} className="px-4 py-2 tabular-nums">
                  {metrics ? value(metrics) : <span className="text-muted-foreground">No data</span>}
                  {label === 'Duration' && agent === fastest ? (
                    <span className="ml-2 font-medium">Fastest</span>
                  ) : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
