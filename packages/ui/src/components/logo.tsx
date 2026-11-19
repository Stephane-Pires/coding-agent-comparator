import type { SVGProps } from 'react';

/**
 * The product's logo: a bobble hat over a ski mask whose lens is a terminal prompt.
 *
 * Decorative: what it stands beside says what it is, so it is hidden from screen readers. Its colours are fixed,
 * the app's three pinks and one ink, so it is the same in both themes; the mask's pink frame keeps the dark lens
 * visible on a dark page. For 16 px there is a simpler drawing: the web app's `icon.svg`.
 *
 * Inside a `logo-button` (styles.css) it answers a pointer or the keyboard: the hat hops, and the prompt's cursor
 * blinks for as long as it is pointed at.
 */
export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true" {...props}>
      {/* the hat: pompom, cap, ribbed cuff */}
      <g className="logo-hat">
        <circle cx="32" cy="8.5" r="6.5" fill="#f59ecf" />
        <path d="M12 33Q12 12 32 12Q52 12 52 33Z" fill="#d14ba0" />
        <rect x="8" y="29" width="48" height="11" rx="5.5" fill="#b42486" />
        <path
          d="M20 31.5v6M28 31.5v6M36 31.5v6M44 31.5v6"
          stroke="#d14ba0"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
      {/* the mask, and the prompt in its lens: a chevron and a cursor */}
      <rect
        x="10.5"
        y="44.5"
        width="43"
        height="15"
        rx="7.5"
        fill="#0a0a0a"
        stroke="#d14ba0"
        strokeWidth="3"
      />
      <g fill="none" stroke="#f59ecf" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 48.5L24.5 52L20 55.5" />
        <path className="logo-cursor" d="M29 56H37" />
      </g>
    </svg>
  );
}
