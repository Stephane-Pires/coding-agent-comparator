import type { ReactNode } from 'react';

/** How every page starts: its title, then one line saying what the page is for. */
export function PageHeader({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <header className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description ? <p className="max-w-prose text-base text-muted-foreground">{description}</p> : null}
    </header>
  );
}
