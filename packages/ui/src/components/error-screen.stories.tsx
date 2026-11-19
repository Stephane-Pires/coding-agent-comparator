import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '@comparator/ui/components/ui/button';

import { ErrorScreen, OffPiste, StoppedLift } from './error-screen.tsx';

const meta = { title: 'Layout/ErrorScreen', component: ErrorScreen } satisfies Meta<typeof ErrorScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 404: the address leads nowhere. */
export const NotFound: Story = {
  args: {
    picture: <OffPiste className="w-60" />,
    title: 'Off the marked runs.',
    line: 'This page is not on the map.',
    children: <Button>Back to the start</Button>,
  },
};

/** 5xx: something broke on our side. */
export const Failed: Story = {
  args: {
    picture: <StoppedLift className="w-60" />,
    title: 'The lift is stopped.',
    line: 'Something broke on our side. Try again in a moment.',
    children: <Button>Try again</Button>,
  },
};
