import type { Meta, StoryObj } from '@storybook/react-vite';

import { PageHeader } from './page-header.tsx';

const meta = { title: 'Layout/PageHeader', component: PageHeader } satisfies Meta<typeof PageHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const TitleOnly: Story = { args: { title: 'Compare coding agents' } };
export const WithDescription: Story = {
  args: {
    title: 'Compare coding agents',
    description: 'Send one task to Claude Code and Codex, and watch how each one handles it.',
  },
};
