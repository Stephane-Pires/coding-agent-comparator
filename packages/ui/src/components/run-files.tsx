'use client';

import { useState } from 'react';

import type { WorkspaceFile } from '@comparator/contracts';
import { FileTree, FileTreeFile, FileTreeFolder } from '@comparator/ui/components/ai-elements/file-tree';
import { FileViewer } from '@comparator/ui/components/file-viewer';

interface Folder {
  readonly folders: Map<string, Folder>;
  readonly files: { name: string; path: string }[];
}

/** The folders and files behind a list of paths. */
function treeOf(paths: readonly string[]): Folder {
  const root: Folder = { folders: new Map(), files: [] };
  for (const path of paths) {
    const names = path.split('/');
    const name = names.pop() ?? path;
    let folder = root;
    for (const part of names) {
      const next = folder.folders.get(part) ?? { folders: new Map(), files: [] };
      folder.folders.set(part, next);
      folder = next;
    }
    folder.files.push({ name, path });
  }
  return root;
}

const byName = (a: string, b: string) => a.localeCompare(b);

/** A folder's content: its folders first, then its files, each by name. */
function Entries({ folder, parent }: { folder: Folder; parent: string }) {
  return (
    <>
      {[...folder.folders.keys()].toSorted(byName).map((name) => {
        const path = `${parent}${name}`;
        const child = folder.folders.get(name);
        return child ? (
          <FileTreeFolder key={path} name={name} path={path}>
            <Entries folder={child} parent={`${path}/`} />
          </FileTreeFolder>
        ) : null;
      })}
      {folder.files
        .toSorted((a, b) => byName(a.name, b.name))
        .map((file) => (
          <FileTreeFile key={file.path} name={file.name} path={file.path} />
        ))}
    </>
  );
}

/** Every folder on the way to each path: `src/lib/a.ts` gives `src` and `src/lib`. */
const foldersOf = (paths: readonly string[]): string[] =>
  paths.flatMap((path) => {
    const names = path.split('/').slice(0, -1);
    return names.map((_, index) => names.slice(0, index + 1).join('/'));
  });

/**
 * The files an agent left in its workspace: a tree to move through them, and the selected file below it, on the
 * column's full width: code needs the room. The tree follows the run: a file appears when the agent writes it.
 */
export function RunFiles({ files }: { files: readonly WorkspaceFile[] }) {
  const present = files.filter((file) => file.state !== 'deleted');
  const paths = present.map((file) => file.path);
  // Folders are open unless the user closed them, so one that appears during the run shows what is in it.
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string>();
  const selected = present.find((file) => file.path === selectedPath);

  const folders = foldersOf(paths);
  const expanded = new Set(folders.filter((path) => !closed.has(path)));

  return (
    <section aria-label="Files" className="flex flex-col gap-2">
      <h4 className="flex items-baseline gap-1 text-sm font-medium">
        Files
        <span className="text-xs font-normal text-muted-foreground tabular-nums">{present.length}</span>
      </h4>
      <div className="flex flex-col gap-3">
        <FileTree
          aria-label="Files"
          expanded={expanded}
          onExpandedChange={(open) => setClosed(new Set(folders.filter((path) => !open.has(path))))}
          onSelect={setSelectedPath}
          selectedPath={selected?.path}
        >
          <Entries folder={treeOf(paths)} parent="" />
        </FileTree>
        {selected ? (
          // The frame of a snippet in an agent's message: a label, then the code on an inset panel.
          <div className="flex min-w-0 flex-col gap-2 rounded-xl border p-2">
            <p className="ml-1 truncate font-mono text-xs leading-8 text-muted-foreground">{selected.path}</p>
            <div className="h-96 overflow-hidden rounded-md border bg-background">
              <FileViewer file={selected} />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
