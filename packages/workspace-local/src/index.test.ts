import { existsSync, mkdirSync, readdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

import { localWorkspaces } from './index.ts';

describe('local workspaces', () => {
  it('creates an empty folder under the temp directory, outside the repository', async () => {
    const workspaces = localWorkspaces();
    const workspace = (await workspaces.create())._unsafeUnwrap();
    expect(readdirSync(workspace.path)).toEqual([]);
    expect(relative(realpathSync(tmpdir()), workspace.path).startsWith('..')).toBe(false);
    expect(realpathSync(workspace.path)).toBe(workspace.path);
    const repository = resolve(import.meta.dirname, '../../..');
    expect(relative(repository, workspace.path).startsWith('..')).toBe(true);
    await workspaces.dispose(workspace);
  });

  it('never gives the same folder twice', async () => {
    const workspaces = localWorkspaces();
    const first = (await workspaces.create())._unsafeUnwrap();
    const second = (await workspaces.create())._unsafeUnwrap();
    expect(first.path).not.toBe(second.path);
    await Promise.all([workspaces.dispose(first), workspaces.dispose(second)]);
  });

  it('reads the files an agent left, in folders too, by path', async () => {
    const workspaces = localWorkspaces();
    const workspace = (await workspaces.create())._unsafeUnwrap();
    expect(await workspaces.read(workspace)).toEqual([]);
    mkdirSync(join(workspace.path, 'src/lib'), { recursive: true });
    writeFileSync(join(workspace.path, 'src/lib/add.mjs'), 'export const add = (a, b) => a + b;\n');
    writeFileSync(join(workspace.path, 'README.md'), '# Héllo\n');
    expect(await workspaces.read(workspace)).toEqual([
      { path: 'README.md', content: '# Héllo\n', state: 'complete' },
      { path: 'src/lib/add.mjs', content: 'export const add = (a, b) => a + b;\n', state: 'complete' },
    ]);
    await workspaces.dispose(workspace);
  });

  it('lists a binary file without its content', async () => {
    const workspaces = localWorkspaces();
    const workspace = (await workspaces.create())._unsafeUnwrap();
    writeFileSync(join(workspace.path, 'image.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2]));
    expect(await workspaces.read(workspace)).toEqual([{ path: 'image.png', content: '', state: 'binary' }]);
    await workspaces.dispose(workspace);
  });

  it('leaves out installed dependencies, Git data, and links, which can point outside the workspace', async () => {
    const workspaces = localWorkspaces();
    const workspace = (await workspaces.create())._unsafeUnwrap();
    for (const folder of ['node_modules/left-pad', '.git']) {
      mkdirSync(join(workspace.path, folder), { recursive: true });
      writeFileSync(join(workspace.path, folder, 'index.js'), '');
    }
    symlinkSync('/etc/hosts', join(workspace.path, 'hosts'));
    writeFileSync(join(workspace.path, 'kept.txt'), 'kept');
    expect(await workspaces.read(workspace)).toEqual([
      { path: 'kept.txt', content: 'kept', state: 'complete' },
    ]);
    await workspaces.dispose(workspace);
  });

  it('removes the folder and what the agent left in it', async () => {
    const workspaces = localWorkspaces();
    const workspace = (await workspaces.create())._unsafeUnwrap();
    writeFileSync(join(workspace.path, 'hello.mjs'), 'console.log(1);\n');
    await workspaces.dispose(workspace);
    expect(existsSync(workspace.path)).toBe(false);
  });
});
