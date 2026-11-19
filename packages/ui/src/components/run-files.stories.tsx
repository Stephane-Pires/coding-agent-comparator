import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';

import type { WorkspaceFile } from '@comparator/contracts';

import { RunFiles } from './run-files.tsx';

const file = (path: string, content: string, state: WorkspaceFile['state'] = 'complete'): WorkspaceFile => ({
  path,
  content,
  state,
});

const FILES = [
  file('package.json', '{\n  "name": "math",\n  "type": "module"\n}\n'),
  file(
    'src/math.mjs',
    '// Adds two numbers.\nexport function sum(a, b) {\n  return a + b;\n}\n\nexport const PI = 3.14159;\n',
  ),
  file(
    'src/math.test.mjs',
    "import { sum } from './math.mjs';\n\nconsole.assert(sum(2, 3) === 5, 'sum adds two numbers');\n",
  ),
  file('assets/logo.png', '', 'binary'),
  file('data/values.csv', 'id,value\n1,10\n2,20\n'),
  file('notes.txt', '', 'deleted'),
];

const meta = {
  title: 'Run/RunFiles',
  component: RunFiles,
  args: { files: FILES },
} satisfies Meta<typeof RunFiles>;
export default meta;
type Story = StoryObj<typeof meta>;

const open = (name: string): NonNullable<Story['play']> =>
  async function play({ canvasElement }) {
    await userEvent.click(within(canvasElement).getByRole('treeitem', { name }));
  };

/** The tree alone: folders first and open, then files. A deleted file is not listed. */
export const Tree: Story = {};

/** A file is selected: its content shows below the tree, in a read-only editor. */
export const FileOpen: Story = { play: open('math.mjs') };

/** A binary file is listed, and its content is not shown. */
export const BinaryFile: Story = { play: open('logo.png') };
