'use client';

import { Logo } from '@comparator/ui/components/logo';

/**
 * How every page starts: the logo. The product has no name, so the logo stands alone; the page's title is still
 * there for screen readers and for the outline of the page.
 *
 * The logo is the way back to a fresh page: a click reloads it.
 */
export function PageHeader({ title }: { title: string }) {
  return (
    <header className="flex">
      <button
        type="button"
        aria-label="Reload the page"
        title="Reload the page"
        onClick={() => window.location.reload()}
        className="logo-button cursor-pointer rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Logo className="size-12" />
      </button>
      <h1 className="sr-only">{title}</h1>
    </header>
  );
}
