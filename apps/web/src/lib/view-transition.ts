import { flushSync } from 'react-dom';

/** Whether the person asked their system for less motion. */
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Makes a change of the page that the browser animates from the old state to the new one: what is in both moves
 * to its new place (the elements that share a `view-transition-name`), the rest fades. Where the browser cannot,
 * or the person asked for less motion, the change is simply made.
 */
export function withViewTransition(change: () => void): void {
  if (typeof document.startViewTransition !== 'function' || reducedMotion()) change();
  // The browser pictures the page before and after `change`: React must have drawn the new one by then.
  else document.startViewTransition(() => flushSync(change));
}
