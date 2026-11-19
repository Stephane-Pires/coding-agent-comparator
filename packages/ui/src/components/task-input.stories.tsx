import type { Meta, StoryObj } from '@storybook/react-vite';

import { TaskInput } from './task-input.tsx';

const meta = {
  title: 'Chat/TaskInput',
  component: TaskInput,
  args: { running: false, onSend: () => {}, onStop: () => {} },
} satisfies Meta<typeof TaskInput>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing typed yet: Send is disabled. */
export const Empty: Story = {};

/** Sample tasks fill the field; the user can still edit before sending. */
export const WithSamples: Story = {
  args: {
    samples: [
      { label: 'Hello script', task: 'Create hello.mjs that prints "hi", then run it with node.' },
      {
        label: 'Tested function',
        task: 'Write a slugify function in slugify.mjs with tests using node:test, then run the tests.',
      },
    ],
  },
};

/** While runs are in progress, the one button is Stop. */
export const Running: Story = { args: { running: true } };
