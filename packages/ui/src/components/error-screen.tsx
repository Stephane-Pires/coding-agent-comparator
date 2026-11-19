import type { ReactNode, SVGProps } from 'react';

/** For a page that does not exist: a ski track that leaves the marked run, past its poles, and off the mountain. */
export function OffPiste(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120" aria-hidden="true" {...props}>
      <path className="fill-muted" d="M0 120V96L84 30Q120 14 150 34L240 86V120Z" />
      <path className="fill-muted-foreground/40" d="M22 104l6 -14l6 14ZM38 110l5 -11l5 11Z" />
      {/* the poles that mark the edge of the run */}
      <g className="stroke-muted-foreground" strokeWidth="2" strokeLinecap="round">
        <path d="M150 62V48M166 82V68M182 102V88" />
      </g>
      <g className="fill-muted-foreground">
        <circle cx="150" cy="46" r="3.5" />
        <circle cx="166" cy="66" r="3.5" />
        <circle cx="182" cy="86" r="3.5" />
      </g>
      <path
        className="stroke-brand"
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        d="M118 30C104 44 124 58 142 66S198 70 224 56"
      />
    </svg>
  );
}

/** For a failure on our side: a chairlift standing still, one chair hanging from its cable. */
export function StoppedLift(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120" aria-hidden="true" {...props}>
      <path className="fill-muted" d="M0 120V104Q60 90 120 100T240 94V120Z" />
      {/* two pylons and the cable between them */}
      <g className="stroke-muted-foreground" fill="none" strokeWidth="2" strokeLinecap="round">
        <path d="M44 102V26M36 30H52M196 96V40M188 44H204" />
        <path d="M8 26L232 46" />
      </g>
      {/* the chair, seen from the side: its hanger, back, seat, footrest and safety bar */}
      <g className="stroke-brand" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M120 36V50Q120 57 112 57M112 57V78H134V88M112 66H130" />
      </g>
    </svg>
  );
}

/**
 * A whole-page message for when there is no page to show: a picture, what happened in a few words, one plain
 * sentence, and one way out (given as children).
 */
export function ErrorScreen({
  picture,
  title,
  line,
  children,
}: {
  picture: ReactNode;
  title: string;
  line: string;
  children: ReactNode;
}) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-3 p-8 text-center">
      {picture}
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="text-sm text-muted-foreground">{line}</p>
      {children}
    </div>
  );
}
