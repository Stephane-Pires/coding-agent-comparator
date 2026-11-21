import type { Meta, StoryObj } from '@storybook/react-vite';

import { Signature } from './signature.tsx';

const meta = { title: 'Layout/Signature', component: Signature } satisfies Meta<typeof Signature>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The foot of every page. */
export const Default: Story = {};
