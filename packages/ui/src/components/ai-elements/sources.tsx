'use client';

// From the AI Elements registry. Changed: pink as text uses the brand token; only what the comparator shows is kept.

import { cn } from 'cn';
import { BookIcon, ChevronDownIcon } from 'lucide-react';
import type { ComponentProps } from 'react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@comparator/ui/components/ui/collapsible';

export type SourcesProps = ComponentProps<'div'>;

export const Sources = ({ className, ...props }: SourcesProps) => (
  <Collapsible className={cn('not-prose text-brand text-xs', className)} {...props} />
);

export type SourcesTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  count: number;
};

export const SourcesTrigger = ({ className, count, ...props }: SourcesTriggerProps) => (
  <CollapsibleTrigger className={cn('flex items-center gap-2', className)} {...props}>
    <p className="font-medium">Used {count} sources</p>
    <ChevronDownIcon className="h-4 w-4" />
  </CollapsibleTrigger>
);

export type SourcesContentProps = ComponentProps<typeof CollapsibleContent>;

export const SourcesContent = ({ className, ...props }: SourcesContentProps) => (
  <CollapsibleContent className={cn('mt-3 flex w-fit flex-col gap-2 outline-none', className)} {...props} />
);

export type SourceProps = ComponentProps<'a'>;

export const Source = ({ href, title, ...props }: SourceProps) => (
  <a className="flex items-center gap-2" href={href} rel="noreferrer" target="_blank" {...props}>
    <BookIcon className="h-4 w-4" />
    <span className="block font-medium">{title}</span>
  </a>
);
