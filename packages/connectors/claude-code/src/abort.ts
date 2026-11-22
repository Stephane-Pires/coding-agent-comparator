/**
 * The SDK takes an `AbortController`, not a signal: this gives one that aborts when `signal` does, and a function
 * that stops following `signal` once the work is over.
 */
export function followAbort(signal: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  return { controller, stopFollowing: () => signal.removeEventListener('abort', abort) };
}
