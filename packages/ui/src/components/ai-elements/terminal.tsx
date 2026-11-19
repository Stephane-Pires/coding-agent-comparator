'use client';

// From the AI Elements registry, reduced to the output panel: text with its ANSI colours, scrolled to the end as
// it grows. Left out of the registry version: the header, the title, and the copy and clear buttons.
import AnsiModule from 'ansi-to-react';
import type { HTMLAttributes } from 'react';
import { useEffect, useRef } from 'react';

import { cn } from '@comparator/ui/lib/utils';

// The library is CommonJS: depending on the bundler, its default export arrives as the component or as the module.
const Ansi: typeof AnsiModule =
  'default' in AnsiModule ? (AnsiModule.default as typeof AnsiModule) : AnsiModule;

export type TerminalProps = HTMLAttributes<HTMLDivElement> & {
  output: string;
  /** The command is still running: a cursor follows the text. */
  isStreaming?: boolean;
};

export const Terminal = ({ output, isStreaming = false, className, ...props }: TerminalProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [output]);

  return (
    <div
      aria-label="Output"
      className={cn(
        'max-h-96 overflow-auto rounded-md bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-100',
        className,
      )}
      ref={containerRef}
      role="region"
      // A scrollable area must be reachable with the keyboard.
      tabIndex={0}
      {...props}
    >
      <pre className="break-words whitespace-pre-wrap">
        <Ansi>{output}</Ansi>
        {isStreaming && <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-zinc-100" />}
      </pre>
    </div>
  );
};
