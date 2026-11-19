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

/** While runs are in progress, the one button is Stop. */
export const Running: Story = { args: { running: true } };
