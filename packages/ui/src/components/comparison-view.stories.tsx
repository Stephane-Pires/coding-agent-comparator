import type { Meta, StoryObj } from '@storybook/react-vite';

import { ComparisonView } from './comparison-view.tsx';
import { RunColumn } from './run-column.tsx';

const meta = { title: 'Run/ComparisonView' } satisfies Meta;
export default meta;
type Story = StoryObj;

const TASK = 'Create hello.mjs that prints "hi", then run it with node.';

/** Both agents got the same task. One is done, the other still works. */
export const OneStillRunning: Story = {
  render: () => (
    <ComparisonView task={TASK}>
      <RunColumn
        agent="claude-code"
        status="running"
        messages={[{ id: '1', text: 'I will create the file, then run it.' }]}
      />
      <RunColumn
        agent="codex"
        status="succeeded"
        messages={[{ id: '1', text: 'Created and ran `hello.mjs`. It printed `hi`.' }]}
      />
    </ComparisonView>
  ),
};

/** One agent failed; the other run is not affected. */
export const OneFailed: Story = {
  render: () => (
    <ComparisonView task={TASK}>
      <RunColumn
        agent="claude-code"
        status="failed"
        messages={[]}
        failureReason="There's an issue with the selected model (no-such-model). It may not exist or you may not have access to it."
      />
      <RunColumn
        agent="codex"
        status="succeeded"
        messages={[{ id: '1', text: 'Created and ran `hello.mjs`. It printed `hi`.' }]}
      />
    </ComparisonView>
  ),
};
