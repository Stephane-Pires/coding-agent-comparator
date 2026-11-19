import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';

import { RunColumn, type RunItem } from './run-column.tsx';

const ANSWER = `I created \`hello.mjs\` and ran it.

\`\`\`js
console.log('hi');
\`\`\`

It printed **hi**.`;

const message = (id: string, text: string): RunItem => ({ type: 'message', id, text });
const command = (
  id: string,
  text: string,
  output: string,
  status: 'running' | 'succeeded' = 'succeeded',
): RunItem => ({
  type: 'tool-call',
  call: { id, tool: { type: 'command', command: text }, status, output },
});

const meta = {
  title: 'Run/RunColumn',
  component: RunColumn,
  args: { agent: 'claude-code', status: 'succeeded', items: [] },
} satisfies Meta<typeof RunColumn>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The agent started and has done nothing yet. */
export const Started: Story = { args: { status: 'running' } };

/** The agent is at work: what it says and what it does appear in order. */
export const Working: Story = {
  args: {
    status: 'running',
    items: [
      message('1', 'I will check the current Node.js version, then create the file and run it.'),
      {
        type: 'tool-call',
        call: {
          id: 's1',
          tool: {
            type: 'web-search',
            query: 'current Node.js LTS version 2026',
            sources: [
              { title: 'Node.js — Node.js Releases', url: 'https://nodejs.org/en/about/previous-releases' },
            ],
          },
          status: 'succeeded',
          output: '',
        },
      },
      {
        type: 'tool-call',
        call: {
          id: 'w1',
          tool: { type: 'other', name: 'Write', input: 'hello.mjs' },
          status: 'succeeded',
          output: '',
        },
      },
      command('c1', 'node hello.mjs', '', 'running'),
    ],
  },
};

export const Succeeded: Story = {
  args: {
    agent: 'codex',
    items: [
      message('1', 'I will create the file, then run it.'),
      command('c1', `cat > hello.mjs <<'EOF'\nconsole.log('hi');\nEOF\nnode hello.mjs`, 'hi\n'),
      message('2', ANSWER),
    ],
  },
};

/** The files the agent left show under what it said and did. */
export const WithFiles: Story = {
  args: {
    agent: 'codex',
    items: [
      message('1', 'I will create the file, then run it.'),
      command('c1', `cat > hello.mjs <<'EOF'\nconsole.log('hi');\nEOF\nnode hello.mjs`, 'hi\n'),
    ],
    files: [
      { path: 'hello.mjs', content: "console.log('hi');\n", state: 'complete' },
      { path: 'docs/notes.md', content: '# Notes\n', state: 'complete' },
    ],
  },
};

const SORT = `export function sort(values: number[]): number[] {
  // A copy, so the input is left as it was.
  const result = [...values];
  return result.sort((a, b) => a - b);
}
`;

/** Code reads the same in an agent's message and in the file it wrote. */
export const SnippetAndFile: Story = {
  args: {
    items: [message('1', `Here is the function:\n\n\`\`\`ts\n${SORT}\`\`\``)],
    files: [{ path: 'sort.ts', content: SORT, state: 'complete' }],
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('treeitem', { name: 'sort.ts' }));
  },
};

/** A failed run says why, in the agent's own words. */
export const Failed: Story = {
  args: {
    status: 'failed',
    failureReason:
      "There's an issue with the selected model (no-such-model). It may not exist or you may not have access to it.",
  },
};

export const Cancelled: Story = {
  args: { status: 'cancelled', items: [message('1', 'I will create the file, then run it.')] },
};

/** More than a hundred events: consecutive tool calls form blocks, each one line per call. */
export const LongRun: Story = {
  args: {
    items: Array.from({ length: 12 }, (_, step) => [
      message(`m${step}`, `Step ${step + 1}: writing the next file and checking it.`),
      ...Array.from({ length: 9 }, (_unused, index) =>
        command(`c${step}-${index}`, `echo ${step * 9 + index + 1} > ${step * 9 + index + 1}.txt`, ''),
      ),
    ]).flat(),
  },
};
