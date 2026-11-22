'use client';

import { useState, type CSSProperties } from 'react';

type FlakeStyle = CSSProperties & Record<`--${string}`, string>;

const FLAKE_COUNT = 40;
const PINKS = ['#f59ecf', '#d14ba0', '#b42486'];

// Flakes are spread by arithmetic, not chance, so that every fall is the same and can be tested.
const getFallMs = (index: number) => 2600 + ((index * 370) % 1900); // 2.6 to 4.5 s to cross the page
const getDelayMs = (index: number) => (index * 173) % 1400; // they do not start together
const getLandingMs = (index: number) => getDelayMs(index) + getFallMs(index);

/** The flake that lands last: the one whose delay and fall add up to the most. */
const SLOWEST_FLAKE = Array.from({ length: FLAKE_COUNT }, (_, index) => index).reduce((slowest, index) =>
  getLandingMs(index) > getLandingMs(slowest) ? index : slowest,
);

/** The style of flake number `index`. */
function createFlake(index: number): FlakeStyle {
  const size = 3 + (index % 5); // 3 to 7 px
  return {
    left: `${(index * 37 + 11) % 100}%`,
    width: size,
    height: size,
    backgroundColor: PINKS[index % PINKS.length],
    '--shade': String(0.55 + (index % 4) * 0.15),
    '--fall': `${getFallMs(index)}ms`,
    '--delay': `${getDelayMs(index)}ms`,
    '--drift': `${((index * 29) % 80) - 40}px`,
  };
}

/**
 * A short fall of pink snow over the whole page, once: a small celebration when a comparison ends well. It sits
 * above the page without catching the pointer, says nothing to screen readers, and removes itself when the last
 * flake has landed. With reduced motion nothing is seen (docs/design/look-and-feel.md, Motion).
 */
export function Snowfall() {
  const [hasLanded, setHasLanded] = useState(false);
  if (hasLanded) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {Array.from({ length: FLAKE_COUNT }, (_, index) => (
        <span
          key={index}
          className="snowflake"
          style={createFlake(index)}
          onAnimationEnd={index === SLOWEST_FLAKE ? () => setHasLanded(true) : undefined}
        />
      ))}
    </div>
  );
}
