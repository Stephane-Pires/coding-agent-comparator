import type { Meta, StoryObj } from '@storybook/react-vite';

import { PasswordGate } from './password-gate.tsx';

const meta = {
  title: 'Layout/PasswordGate',
  component: PasswordGate,
  args: { action: () => {} },
  decorators: [
    (Story) => (
      <div className="h-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PasswordGate>;
export default meta;
type Story = StoryObj<typeof meta>;

/** What a browser without its pass sees. */
export const Asking: Story = {};

/** While the password is checked. */
export const Checking: Story = { args: { pending: true } };

/** After a wrong password. */
export const Wrong: Story = { args: { error: 'That is not the password. Check it and try again.' } };
