import { existsSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
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

  it('removes the folder and what the agent left in it', async () => {
    const workspaces = localWorkspaces();
    const workspace = (await workspaces.create())._unsafeUnwrap();
    writeFileSync(join(workspace.path, 'hello.mjs'), 'console.log(1);\n');
    await workspaces.dispose(workspace);
    expect(existsSync(workspace.path)).toBe(false);
  });
});
