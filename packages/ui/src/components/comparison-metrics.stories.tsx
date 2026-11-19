import type { Meta, StoryObj } from '@storybook/react-vite';

import type { Metrics } from '@comparator/contracts';

import { ComparisonMetrics } from './comparison-metrics.tsx';

// The numbers of two recorded runs.
const CLAUDE: Metrics = {
  durationMs: 31_240,
  usage: { inputTokens: 139_134, cachedInputTokens: 83_795, outputTokens: 3422, costUsd: 0.030_474_65 },
  toolCalls: 4,
  files: 1,
};
const CODEX: Metrics = {
  durationMs: 19_410,
  usage: { inputTokens: 56_186, cachedInputTokens: 48_000, outputTokens: 277, costUsd: null },
  toolCalls: 2,
  files: 1,
};

const meta = {
  title: 'Comparison/ComparisonMetrics',
  component: ComparisonMetrics,
} satisfies Meta<typeof ComparisonMetrics>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Both runs succeeded: the faster one is marked. A value an agent does not give says so. */
export const BothSucceeded: Story = {
  args: {
    runs: [
      { agent: 'claude-code', status: 'succeeded', metrics: CLAUDE },
      { agent: 'codex', status: 'succeeded', metrics: CODEX },
    ],
  },
};

/** A run that failed still has what was measured; with no usage reported when the agent crashed. Nobody is "fastest". */
export const OneFailed: Story = {
  args: {
    runs: [
      { agent: 'claude-code', status: 'succeeded', metrics: CLAUDE },
      {
        agent: 'codex',
        status: 'failed',
        metrics: { durationMs: 4200, usage: null, toolCalls: 1, files: 0 },
      },
    ],
  },
};

/** A cancelled run has no numbers. */
export const OneCancelled: Story = {
  args: {
    runs: [
      { agent: 'claude-code', status: 'cancelled' },
      { agent: 'codex', status: 'succeeded', metrics: CODEX },
    ],
  },
};

/** In a narrow space the table scrolls sideways. */
export const Narrow: Story = {
  ...BothSucceeded,
  decorators: [(story) => <div className="max-w-xs">{story()}</div>],
};
