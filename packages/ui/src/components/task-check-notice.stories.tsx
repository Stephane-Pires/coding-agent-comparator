import type { Meta, StoryObj } from '@storybook/react-vite';

import { TaskCheckNotice } from './task-check-notice.tsx';

const meta = { title: 'Chat/TaskCheckNotice', component: TaskCheckNotice } satisfies Meta<
  typeof TaskCheckNotice
>;
export default meta;
type Story = StoryObj<typeof meta>;

/** For a few seconds after Send: the task is checked before any agent starts. */
export const Checking: Story = { args: { state: { status: 'checking' } } };

/** Not a coding task: no agent started, and the sentence says how to rephrase. */
export const Refused: Story = {
  args: {
    state: {
      status: 'refused',
      reason: 'This asks for an explanation, not code. Ask for a script or a small project instead.',
    },
  },
};

/** The user pressed Stop during the check. */
export const Stopped: Story = { args: { state: { status: 'stopped' } } };
