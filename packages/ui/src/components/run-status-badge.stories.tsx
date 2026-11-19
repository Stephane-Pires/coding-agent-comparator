import type { Meta, StoryObj } from '@storybook/react-vite';

import { RunStatusBadge } from './run-status-badge.tsx';

const meta = { title: 'Run/RunStatusBadge', component: RunStatusBadge } satisfies Meta<typeof RunStatusBadge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Running: Story = { args: { status: 'running' } };
export const Succeeded: Story = { args: { status: 'succeeded' } };
export const Incomplete: Story = { args: { status: 'incomplete' } };
export const Failed: Story = { args: { status: 'failed' } };
export const Cancelled: Story = { args: { status: 'cancelled' } };
