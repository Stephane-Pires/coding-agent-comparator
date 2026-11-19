import { Logo } from '@comparator/ui/components/logo';

/**
 * How every page starts: the logo. The product has no name, so the logo stands alone; the page's title is still
 * there for screen readers and for the outline of the page.
 *
 * The logo is the way back to the start page, from any page.
 */
export function PageHeader({ title }: { title: string }) {
  return (
    <header className="flex">
      <a
        href="/"
        aria-label="Back to the start"
        title="Back to the start"
        className="logo-button rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Logo className="size-12" />
      </a>
      <h1 className="sr-only">{title}</h1>
    </header>
  );
}
