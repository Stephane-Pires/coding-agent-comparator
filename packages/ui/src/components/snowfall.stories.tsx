import type { Meta, StoryObj } from '@storybook/react-vite';

import { Snowfall } from './snowfall.tsx';

const meta = { title: 'Chat/Snowfall', component: Snowfall } satisfies Meta<typeof Snowfall>;
export default meta;

/** Falls once over the whole page, then removes itself. Reload the story to see it again. */
export const Falling: StoryObj<typeof meta> = {};
