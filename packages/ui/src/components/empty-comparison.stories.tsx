import type { Meta, StoryObj } from '@storybook/react-vite';

import { EmptyComparison } from './empty-comparison.tsx';

const meta = { title: 'Chat/EmptyComparison', component: EmptyComparison } satisfies Meta<
  typeof EmptyComparison
>;
export default meta;

/** What a newcomer sees first: where they are, what to do, and a task to try. */
export const BeforeTheFirstRun: StoryObj<typeof meta> = {};
