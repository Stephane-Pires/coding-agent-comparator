import { useCallback, useEffect, useState } from 'react';

/** Four times a second: often enough for a track to be seen moving, rare enough to cost nothing. */
const TICK_MS = 250;

/**
 * The clock of one comparison: the milliseconds since `startedAt`, a reading of `performance.now()` taken when its
 * runs were started. `now` ticks while `ticking`, for what is drawn; `read` gives the exact time when asked, to
 * stamp something that just happened.
 *
 * The start is given, not taken here: a component can be mounted again while its comparison goes on, and the
 * clock must not start over with it.
 */
export function useClock(startedAt: number, ticking: boolean): { now: number; read: () => number } {
  const read = useCallback(() => performance.now() - startedAt, [startedAt]);
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(read());
    if (!ticking) return undefined;
    const timer = setInterval(() => setNow(read()), TICK_MS);
    return () => clearInterval(timer);
  }, [ticking, read]);
  return { now, read };
}
