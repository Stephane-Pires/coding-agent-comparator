import type { Meta, StoryObj } from '@storybook/react-vite';

import { RunColumn } from './run-column.tsx';

const ANSWER = `I created \`hello.mjs\` and ran it.

\`\`\`js
console.log('hi');
\`\`\`

It printed **hi**.`;

const meta = {
  title: 'Run/RunColumn',
  component: RunColumn,
  args: { agent: 'claude-code', status: 'succeeded', messages: [] },
} satisfies Meta<typeof RunColumn>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The agent started and has said nothing yet. */
export const Started: Story = { args: { status: 'running' } };

/** Text arrives while the run is in progress. */
export const Streaming: Story = {
  args: { status: 'running', messages: [{ id: '1', text: 'I will create the file, then run it.' }] },
};

export const Succeeded: Story = {
  args: {
    agent: 'codex',
    messages: [
      { id: '1', text: 'I will create the file, then run it.' },
      { id: '2', text: ANSWER },
    ],
  },
};

/** A failed run says why, in the agent's own words. */
export const Failed: Story = {
  args: {
    status: 'failed',
    failureReason:
      "There's an issue with the selected model (no-such-model). It may not exist or you may not have access to it.",
  },
};

export const Cancelled: Story = {
  args: { status: 'cancelled', messages: [{ id: '1', text: 'I will create the file, then run it.' }] },
};
