'use client';

// From the AI Elements registry. Changed: the open folders are always given by the caller, a folder's whole row
// opens and closes it (a folder cannot be selected), the selected file uses the selected token and says so to
// screen readers, icons take the text's colour. Removed: `FileTreeActions`, `FileTreeIcon`, `FileTreeName`, the
// per-row contexts and the custom file icon.

import { ChevronRightIcon, FileIcon, FolderIcon, FolderOpenIcon } from 'lucide-react';
import { createContext, useContext, useMemo, type HTMLAttributes, type KeyboardEvent } from 'react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@comparator/ui/components/ui/collapsible';
import { cn } from '@comparator/ui/lib/utils';

interface FileTreeContextType {
  expanded: ReadonlySet<string>;
  toggle: (path: string) => void;
  selectedPath?: string | undefined;
  onSelect: (path: string) => void;
}

const FileTreeContext = createContext<FileTreeContextType>({
  expanded: new Set(),
  toggle: () => undefined,
  onSelect: () => undefined,
});

export type FileTreeProps = Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> & {
  /** The paths of the open folders. */
  expanded: ReadonlySet<string>;
  onExpandedChange: (expanded: Set<string>) => void;
  selectedPath?: string | undefined;
  onSelect: (path: string) => void;
};

export const FileTree = ({
  expanded,
  onExpandedChange,
  selectedPath,
  onSelect,
  className,
  children,
  ...props
}: FileTreeProps) => {
  const contextValue = useMemo(
    () => ({
      expanded,
      onSelect,
      selectedPath,
      toggle: (path: string) => {
        const next = new Set(expanded);
        if (!next.delete(path)) next.add(path);
        onExpandedChange(next);
      },
    }),
    [expanded, onExpandedChange, onSelect, selectedPath],
  );

  return (
    <FileTreeContext.Provider value={contextValue}>
      <div
        className={cn('rounded-md border bg-background p-2 font-mono text-sm', className)}
        role="tree"
        {...props}
      >
        {children}
      </div>
    </FileTreeContext.Provider>
  );
};

const ROW = 'flex w-full items-center gap-1 rounded px-2 py-1 text-left transition-colors hover:bg-accent';

export type FileTreeFolderProps = HTMLAttributes<HTMLDivElement> & { path: string; name: string };

export const FileTreeFolder = ({ path, name, children, ...props }: FileTreeFolderProps) => {
  const { expanded, toggle } = useContext(FileTreeContext);
  const isExpanded = expanded.has(path);
  const Icon = isExpanded ? FolderOpenIcon : FolderIcon;

  return (
    <Collapsible onOpenChange={() => toggle(path)} open={isExpanded}>
      <div aria-expanded={isExpanded} role="treeitem" {...props}>
        <CollapsibleTrigger className={cn(ROW, 'cursor-pointer')}>
          <ChevronRightIcon
            aria-hidden="true"
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform',
              isExpanded && 'rotate-90',
            )}
          />
          <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{name}</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="ml-4 border-l pl-2" role="group">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export type FileTreeFileProps = HTMLAttributes<HTMLDivElement> & { path: string; name: string };

export const FileTreeFile = ({ path, name, className, ...props }: FileTreeFileProps) => {
  const { selectedPath, onSelect } = useContext(FileTreeContext);
  const isSelected = selectedPath === path;

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(path);
    }
  };

  return (
    <div
      aria-selected={isSelected}
      className={cn(ROW, 'cursor-pointer', isSelected && 'bg-selected hover:bg-selected', className)}
      onClick={() => onSelect(path)}
      onKeyDown={handleKeyDown}
      role="treeitem"
      tabIndex={0}
      {...props}
    >
      {/* Spacer: a file's icon lines up with a folder's, which has a chevron before it. */}
      <span className="size-4 shrink-0" />
      <FileIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{name}</span>
    </div>
  );
};
