import type { Meta, StoryObj } from '@storybook/react-vite';

import { RunTracks, type RunTrack, type TrackGate } from './run-tracks.tsx';

const ran = (command: string): TrackGate['tool'] => ({ type: 'command', command });
const wrote: TrackGate['tool'] = { type: 'file-edit', path: 'hello.mjs', change: 'created', diff: '' };

const meta = { title: 'Run/RunTracks', component: RunTracks } satisfies Meta<typeof RunTracks>;
export default meta;
type Story = StoryObj<typeof meta>;

const claude: RunTrack = {
  agent: 'claude-code',
  status: 'succeeded',
  gates: [
    { id: 'a', at: 900, status: 'succeeded', tool: wrote },
    { id: 'b', at: 2100, status: 'succeeded', tool: ran('node hello.mjs') },
  ],
  endedAt: 3800,
  durationMs: 3500,
};
const codex: RunTrack = {
  agent: 'codex',
  status: 'succeeded',
  gates: [{ id: 'a', at: 4200, status: 'succeeded', tool: wrote }],
  endedAt: 9200,
  durationMs: 8900,
};

/** Both run. One has a tool call in progress: its gate is hollow. */
export const BothRunning: Story = {
  args: {
    now: 2600,
    tracks: [
      { ...claude, status: 'running', endedAt: undefined, durationMs: undefined },
      {
        agent: 'codex',
        status: 'running',
        gates: [{ id: 'a', at: 2300, status: 'running', tool: ran('node hello.mjs') }],
      },
    ],
  },
};

/** One crossed the line; the other still runs. */
export const OneFinished: Story = {
  args: {
    now: 6000,
    tracks: [claude, { ...codex, status: 'running', endedAt: undefined, durationMs: undefined }],
  },
};

/** Both did the task: the tracks stay as the record, and the shortest time is marked. */
export const BothFinished: Story = { args: { now: 20_000, tracks: [claude, codex] } };

/** A run that failed, with a tool call that failed, and one that only asked a question back. */
export const NotAllFinished: Story = {
  args: {
    now: 20_000,
    tracks: [
      {
        agent: 'claude-code',
        status: 'failed',
        gates: [
          { id: 'a', at: 1200, status: 'succeeded', tool: wrote },
          { id: 'b', at: 2600, status: 'failed', tool: ran('node hello.mjs') },
        ],
        endedAt: 3100,
        durationMs: 3000,
      },
      { ...codex, status: 'incomplete', gates: [] },
    ],
  },
};

/** A run the user stopped: no time is shown for it. */
export const Stopped: Story = {
  args: {
    now: 20_000,
    tracks: [
      claude,
      {
        agent: 'codex',
        status: 'cancelled',
        gates: [{ id: 'a', at: 1500, status: 'running', tool: wrote }],
        endedAt: 2500,
      },
    ],
  },
};

/** A long run: the slope is wider than its room, and scrolls sideways. A short one ended long ago. */
export const LongerThanTheRoom: Story = {
  args: {
    now: 74_000,
    tracks: [
      claude,
      {
        agent: 'codex',
        status: 'running',
        gates: [
          { id: 'a', at: 4200, status: 'succeeded', tool: ran('node hello.mjs') },
          { id: 'b', at: 31_000, status: 'succeeded', tool: wrote },
          { id: 'c', at: 70_500, status: 'running', tool: ran('node hello.mjs') },
        ],
      },
    ],
  },
};
