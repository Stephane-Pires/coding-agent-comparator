/**
 * Who made this, at the foot of every page, in the words he signs his own site with. The name leads there.
 */
export function Signature() {
  return (
    <p className="text-center text-xs text-muted-foreground">
      Made by{' '}
      <a
        href="https://www.stephanepires.com"
        target="_blank"
        rel="noreferrer"
        className="rounded-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        Stéphane Pires
      </a>{' '}
      with{' '}
      <span role="img" aria-label="love" className="text-brand">
        ❤
      </span>
    </p>
  );
}
