import type { SVGProps } from 'react';

const TRACK = '[animation:draw-track_1.2s_ease-out_forwards] [stroke-dasharray:1] [stroke-dashoffset:1]';

/**
 * The product's picture: one slope, and the tracks two skiers leave side by side. One track per agent, the same
 * colour for both: an agent has no colour.
 *
 * The tracks draw themselves once, together, when the picture appears (docs/design/look-and-feel.md, Motion: the
 * one stated exception to "never on page load"). With reduced motion they are simply there.
 */
function TwinTracks(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120" aria-hidden="true" {...props}>
      <path className="fill-muted" d="M0 120V96L84 30Q120 14 150 34L240 86V120Z" />
      <path
        className="fill-muted-foreground/40"
        d="M22 104l6 -14l6 14ZM38 110l5 -11l5 11ZM192 96l6 -14l6 14ZM208 104l5 -11l5 11Z"
      />
      <g className="stroke-brand" fill="none" strokeWidth="3" strokeLinecap="round">
        <path className={TRACK} pathLength="1" d="M106 34C84 48 124 60 100 78S56 102 66 120" />
        <path className={TRACK} pathLength="1" d="M134 34C112 48 152 60 128 78S84 102 94 120" />
      </g>
    </svg>
  );
}

/** The page before the first comparison: what to do, and one task to start from. */
export function EmptyComparison() {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-3 p-8 text-center">
      <TwinTracks className="w-60" />
      <h2 className="text-lg font-medium">Same slope, two agents.</h2>
      <p className="text-sm text-muted-foreground">Give both agents the same task and watch their runs.</p>
      <p className="text-sm text-muted-foreground">
        Try: <span className="text-foreground">“Write a slugify function with tests, then run them.”</span>
      </p>
    </div>
  );
}
