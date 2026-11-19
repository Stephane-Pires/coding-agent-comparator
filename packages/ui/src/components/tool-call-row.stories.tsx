import type { Meta, StoryObj } from '@storybook/react-vite';

import type { ToolCall } from '@comparator/contracts';

import { ToolCallRow } from './tool-call-row.tsx';

const meta = {
  title: 'Run/ToolCallRow',
  component: ToolCallRow,
  decorators: [(Story) => <div className="rounded-md border">{Story()}</div>],
} satisfies Meta<typeof ToolCallRow>;
export default meta;
type Story = StoryObj<typeof meta>;

const call = (fields: Partial<ToolCall> & Pick<ToolCall, 'tool'>): ToolCall => ({
  id: 'call-1',
  status: 'succeeded',
  output: '',
  ...fields,
});

/** A command that just started: nothing to open yet. */
export const CommandRunning: Story = {
  args: { call: call({ tool: { type: 'command', command: 'node --test' }, status: 'running' }) },
};

/** Open the row to read what the command printed. */
export const CommandDone: Story = {
  args: {
    call: call({
      tool: { type: 'command', command: 'node --test' },
      output:
        'TAP version 13\n# Subtest: add sums two numbers\nok 1 - add sums two numbers\n1..1\n# tests 1\n# pass 1\n# fail 0',
    }),
  },
};

export const CommandFailed: Story = {
  args: {
    call: call({
      tool: { type: 'command', command: "rg --files -g 'package.json'" },
      status: 'failed',
      output: 'zsh: command not found: rg',
    }),
  },
};

/** Codex often writes a file and runs it in one command: the row shows its first line, and opens to all of it. */
export const CommandOnSeveralLines: Story = {
  args: {
    call: call({
      tool: {
        type: 'command',
        command: `cat > hello.mjs <<'EOF'\nconsole.log("Node LTS is 26");\nEOF\nnode hello.mjs`,
      },
      output: 'Node LTS is 26\n',
    }),
  },
};

/** Output keeps the colours the command printed. */
export const CommandWithColours: Story = {
  args: {
    call: call({
      tool: { type: 'command', command: 'pnpm test' },
      output:
        '\u001B[32m✓\u001B[39m slugify lowercases\n\u001B[31m✗\u001B[39m slugify trims dashes\n\n1 passed, 1 failed',
      status: 'failed',
    }),
  },
};

/** Codex announces a search before it knows the query. */
export const WebSearchStarting: Story = {
  args: { call: call({ tool: { type: 'web-search', query: '', sources: [] }, status: 'running' }) },
};

export const WebSearchDone: Story = {
  args: {
    call: call({
      tool: {
        type: 'web-search',
        query: 'current Node.js LTS version 2026',
        sources: [
          { title: 'Node.js — Node.js Releases', url: 'https://nodejs.org/en/about/previous-releases' },
          {
            title: 'Node.js — Evolving the Node.js Release Schedule',
            url: 'https://nodejs.org/en/blog/announcements/evolving-the-nodejs-release-schedule',
          },
        ],
      },
    }),
  },
};

/** A file the agent created: one line, the file itself is in the Files section. */
export const FileCreated: Story = {
  args: { call: call({ tool: { type: 'file-edit', path: 'src/math.mjs', change: 'created', diff: '' } }) },
};

/** A file the agent changed: the row opens on the change, when the agent reported it. */
export const FileModified: Story = {
  args: {
    call: call({
      tool: {
        type: 'file-edit',
        path: 'src/math.mjs',
        change: 'modified',
        diff: '@@ -1,3 +1,3 @@\n-export function add(a, b) {\n+export function sum(a, b) {\n   return a + b;\n }',
      },
    }),
  },
};

/** An edit that failed says why. */
export const FileEditFailed: Story = {
  args: {
    call: call({
      tool: { type: 'file-edit', path: 'src/math.mjs', change: 'modified', diff: '' },
      status: 'failed',
      output: 'String to replace not found in file.',
    }),
  },
};

/** Any tool that is neither a command nor a search: its name and what it was pointed at. */
export const OtherTool: Story = {
  args: {
    call: call({
      tool: { type: 'other', name: 'Read', input: 'math.mjs' },
      output: '1\texport function add(a, b) {\n2\t  return a + b;\n3\t}',
    }),
  },
};

/** A tool with nothing to show stays one line. */
export const OtherToolWithNoOutput: Story = {
  args: { call: call({ tool: { type: 'other', name: 'TodoWrite', input: '' } }) },
};
