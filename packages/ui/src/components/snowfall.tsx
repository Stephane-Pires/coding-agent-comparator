'use client';

import { useState, type CSSProperties } from 'react';

const FLAKES = 40;
const PINKS = ['#f59ecf', '#d14ba0', '#b42486'];

type FlakeStyle = CSSProperties & Record<`--${string}`, string>;

/** Flake `i` of the fall. Spread by arithmetic, not chance, so that every fall is the same and can be tested. */
function flake(i: number): FlakeStyle {
  const size = 3 + (i % 5); // 3 to 7 px
  const fall = 2600 + ((i * 370) % 1900); // 2.6 to 4.5 s to cross the page
  const delay = (i * 173) % 1400; // they do not start together
  return {
    left: `${(i * 37 + 11) % 100}%`,
    width: size,
    height: size,
    backgroundColor: PINKS[i % PINKS.length],
    '--shade': String(0.55 + (i % 4) * 0.15),
    '--fall': `${fall}ms`,
    '--delay': `${delay}ms`,
    '--drift': `${((i * 29) % 80) - 40}px`,
  };
}
// The flake that lands last: the one whose delay and fall add up to the most.
const SLOWEST = Array.from(
  { length: FLAKES },
  (_, i) => 2600 + ((i * 370) % 1900) + ((i * 173) % 1400),
).reduce((slowest, time, i, times) => (time > (times[slowest] ?? 0) ? i : slowest), 0);

/**
 * A short fall of pink snow over the whole page, once: a small celebration when a comparison ends well. It sits
 * above the page without catching the pointer, says nothing to screen readers, and removes itself when the last
 * flake has landed. With reduced motion nothing is seen (docs/design/look-and-feel.md, Motion).
 */
export function Snowfall() {
  const [landed, setLanded] = useState(false);
  if (landed) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {Array.from({ length: FLAKES }, (_, i) => (
        <span
          key={i}
          className="snowflake"
          style={flake(i)}
          onAnimationEnd={i === SLOWEST ? () => setLanded(true) : undefined}
        />
      ))}
    </div>
  );
}
