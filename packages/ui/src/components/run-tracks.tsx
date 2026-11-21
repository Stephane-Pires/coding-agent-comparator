import { useEffect, useRef, useState, type CSSProperties, type UIEvent, type WheelEvent } from 'react';

import type { AgentId, RunStatus, Tool, ToolCall } from '@comparator/contracts';
import { AGENT_LABELS } from '@comparator/ui/agents';
import { fastestOf, seconds } from '@comparator/ui/components/comparison-metrics';
import { RUN_STATUSES } from '@comparator/ui/components/run-status-badge';
import { STATUSES, titleOf } from '@comparator/ui/components/tool-call-row';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@comparator/ui/components/ui/tooltip';
import { ICONS } from '@comparator/ui/icons';

/** A tool call on a run's track: when it started, and how it stands. */
export interface TrackGate {
  readonly id: string;
  /** Milliseconds after the comparison started. */
  readonly at: number;
  readonly status: ToolCall['status'];
  /** What was called: said when the gate is pointed at. */
  readonly tool: Tool;
}

/** One agent's run as a track: what happened, and when. */
export interface RunTrack {
  readonly agent: AgentId;
  readonly status: RunStatus;
  readonly gates: readonly TrackGate[];
  /** Milliseconds after the comparison started at which the run ended. */
  readonly endedAt?: number | undefined;
  /** How long the run took, as the API measured it: the number shown at the finish. */
  readonly durationMs?: number | undefined;
}

/**
 * The scale of the tracks, which never changes: one second is this many pixels, the width of one turn of the
 * track (`styles.css`, `.run-course`). So a run is never redrawn at another size: its track only gets longer.
 */
const PX_PER_SECOND = 28;
/** The course drawn ahead of the furthest run, so a track is never seen touching the edge. */
const AHEAD_MS = 2000;
const TICK_EVERY_S = 5;

/**
 * How far the course is drawn, in milliseconds: to the furthest point any run reached, and a little ahead while
 * one still lasts.
 */
export function courseLength(now: number, endedAt: readonly (number | undefined)[]): number {
  const running = endedAt.some((end) => end === undefined);
  const furthest = Math.max(running ? now : 0, ...endedAt.map((end) => end ?? 0));
  return furthest + (running ? AHEAD_MS : 0);
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** A run in words, for who cannot see its track: in the words of its badge. */
function inWords({ agent, status, gates, durationMs }: RunTrack): string {
  const calls = plural(gates.length, 'tool call');
  if (status === 'running') return `${AGENT_LABELS[agent]}: running, ${calls} so far.`;
  const time = durationMs === undefined ? '' : ` in ${seconds.format(durationMs / 1000)} seconds`;
  return `${AGENT_LABELS[agent]}: ${RUN_STATUSES[status].label.toLowerCase()}${time}, ${calls}.`;
}

const px = (time: number) => (time / 1000) * PX_PER_SECOND;
const ROW = 'flex h-6 items-center';

/**
 * A gate: where a tool call started. Hollow while the call runs, filled once done, grey when it failed. Pointed
 * at, it says when exactly, what was called, and how it stands. The same call is a row of the run's column, which
 * is where a keyboard or a screen reader finds it.
 */
function Gate({ gate, style }: { gate: TrackGate; style: CSSProperties }) {
  const { text, code, before } = titleOf(gate.tool);
  const ToolIcon = ICONS.tool[gate.tool.type];
  const { label, tone } = STATUSES[gate.status];
  return (
    <Tooltip>
      {/* larger than the mark it holds, so it is easy to point at */}
      <TooltipTrigger asChild>
        <span
          className="run-mark absolute top-1/2 left-0 z-10 flex size-4 items-center justify-center"
          style={style}
        >
          <span
            // A halo of the card's colour parts the gate from the line it stands on, which has its colour.
            className={`size-2.5 rotate-45 border-2 ring-2 ring-card ${
              gate.status === 'failed'
                ? 'border-muted-foreground bg-muted-foreground'
                : gate.status === 'running'
                  ? 'border-brand bg-card'
                  : 'border-brand bg-brand'
            }`}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="flex max-w-xs flex-col gap-1">
        <span className="flex items-center justify-between gap-4 tabular-nums">
          <span className="font-medium">{seconds.format(gate.at / 1000)} s</span>
          <span className={tone}>{label}</span>
        </span>
        <span className="flex items-center gap-2">
          <ToolIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          {before ? <span className="shrink-0">{before}</span> : null}
          <span className={`line-clamp-3 min-w-0 break-all ${code ? 'font-mono' : ''}`}>{text}</span>
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

/** One run on the course: the part of the track it has skied, its gates, and where it stands or ended. */
function Track({ track, now }: { track: RunTrack; now: number }) {
  const { status, gates, endedAt } = track;
  // A mark stands at its time by being moved, not laid out again.
  const at = (time: number, centred = true) => ({
    translate: `calc(${px(time)}px${centred ? ' - 50%' : ''}) -50%`,
  });
  // Where the track ends: at its end once the run is over. While it lasts, at the clock, or at its
  // last gate if that one came since the clock last ticked: a gate is never ahead of its track.
  const head = endedAt ?? Math.max(now, ...gates.map((gate) => gate.at));
  const EndIcon = status === 'succeeded' ? ICONS.finish : status !== 'running' ? ICONS.run[status] : null;
  return (
    <div className={`${ROW} relative`}>
      {/* the course ahead, then the part of it already skied */}
      <span className="run-course" />
      <span className="run-track" style={{ clipPath: `inset(0 calc(100% - ${px(head)}px) 0 0)` }} />
      {/* a gate per tool call: hollow while it runs, filled once done, grey when it failed */}
      {gates.map((gate) => (
        <Gate key={gate.id} gate={gate} style={at(gate.at)} />
      ))}
      {status === 'running' ? (
        <span
          className="run-mark absolute top-1/2 left-0 size-3 rounded-full border-2 border-brand bg-card"
          style={at(head)}
        />
      ) : null}
      {EndIcon ? (
        <span className="run-mark run-arrival absolute top-1/2 left-0 bg-card pl-1" style={at(head, false)}>
          <EndIcon className={`size-4 ${status === 'succeeded' ? 'text-brand' : 'text-muted-foreground'}`} />
        </span>
      ) : null}
    </div>
  );
}

/**
 * The runs of a comparison on one slope: a track per agent, on one scale of time that never changes. A track
 * grows while its run lasts, each tool call plants a gate where it started, and a flag marks the finish with its
 * time. A run that ended stays where it ended while the others go on. Once the tracks are longer than the room
 * they have, the slope scrolls sideways to follow the furthest run, and can be scrolled back afterwards: it stays
 * as the record of where each agent spent its time, which the totals cannot say.
 *
 * `now` is the clock of the comparison, in milliseconds since it started; whoever renders this makes it tick.
 */
export function RunTracks({ tracks, now }: { tracks: readonly RunTrack[]; now: number }) {
  const fastest = fastestOf(tracks);
  const length = courseLength(
    now,
    tracks.map(({ endedAt }) => endedAt),
  );
  const ticks = Array.from(
    { length: Math.floor(length / 1000 / TICK_EVERY_S) + 1 },
    (_, tick) => tick * TICK_EVERY_S,
  );

  // The slope follows the furthest run. It stops when the person scrolls it sideways themselves, and follows again
  // once they bring it back to its end. Scrolling the page up and down over it changes nothing.
  const slope = useRef<HTMLDivElement>(null);
  const [followed, setFollowed] = useState(true);
  const edge = px(length);
  useEffect(() => {
    const view = slope.current;
    if (!view || !followed) return undefined;
    const end = () => edge - view.clientWidth;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (end() > view.scrollLeft) view.scrollLeft = end();
      return undefined;
    }
    // A glide, drawn every frame: at the pace the tracks grow when the end is near, faster when it is far, so
    // the slope catches up without a jump. The position is kept here, since the browser rounds the one it holds.
    let position = view.scrollLeft;
    let last = performance.now();
    let frame = requestAnimationFrame(function glide(time: number) {
      const gap = end() - position;
      if (gap <= 0) return;
      const pace = Math.max(PX_PER_SECOND * 1.5, gap * 6);
      position += Math.min(gap, (pace * (time - last)) / 1000);
      last = time;
      view.scrollLeft = position;
      frame = requestAnimationFrame(glide);
    });
    return () => cancelAnimationFrame(frame);
  }, [edge, followed]);
  const onWheel = (event: WheelEvent) => {
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) setFollowed(false);
  };
  const onScroll = ({ currentTarget: view }: UIEvent<HTMLDivElement>) => {
    if (view.scrollLeft + view.clientWidth >= view.scrollWidth - PX_PER_SECOND) setFollowed(true);
  };
  const takeOver = () => setFollowed(false);

  return (
    <TooltipProvider delayDuration={100}>
      <figure className="@container flex gap-3 rounded-lg border bg-card p-4 text-sm">
        <figcaption className="sr-only">The runs over time</figcaption>
        <ul className="flex shrink-0 flex-col gap-2 font-medium">
          {tracks.map((track) => {
            const AgentIcon = ICONS.agent[track.agent];
            return (
              <li key={track.agent} className={`${ROW} gap-2`}>
                <span className="sr-only">{inWords(track)}</span>
                <AgentIcon aria-hidden="true" className="size-4 shrink-0" />
                {/* In a narrow block the icon alone names the agent: the room goes to the tracks. */}
                <span aria-hidden="true" className="hidden @lg:inline">
                  {AGENT_LABELS[track.agent]}
                </span>
              </li>
            );
          })}
        </ul>
        <div
          ref={slope}
          role="group"
          aria-label="The tracks. Scroll sideways to see a whole run."
          // Reachable with the keyboard, as anything that scrolls must be.
          tabIndex={0}
          // Room under the marks of time for the scroll bar, which would otherwise lie on them.
          className="min-w-0 flex-1 overflow-x-auto rounded-sm pb-3 outline-none [scrollbar-width:thin] focus-visible:ring-[3px] focus-visible:ring-ring/50"
          onWheel={onWheel}
          onScroll={onScroll}
          onPointerDown={takeOver}
          onKeyDown={takeOver}
        >
          <div aria-hidden="true" className="flex min-w-full flex-col gap-2" style={{ width: edge }}>
            {tracks.map((track) => (
              <Track key={track.agent} track={track} now={now} />
            ))}
            {/* the scale: a mark every five seconds */}
            <p className="relative h-4 text-xs text-muted-foreground tabular-nums">
              {ticks.map((tick) => (
                <span key={tick} className="absolute left-0" style={{ translate: `${px(tick * 1000)}px` }}>
                  {tick} s
                </span>
              ))}
            </p>
          </div>
        </div>
        {/* Its width is kept from the start: a time that arrives takes no room from the tracks. */}
        <ul aria-hidden="true" className="flex w-28 shrink-0 flex-col gap-2 text-right tabular-nums">
          {tracks.map(({ agent, status, durationMs }) => (
            <li key={agent} className={`${ROW} justify-end`}>
              {status === 'running' || durationMs === undefined ? null : (
                <span className="run-arrival">
                  {seconds.format(durationMs / 1000)} s
                  {fastest === agent ? <span className="ml-2 font-medium text-brand">Fastest</span> : null}
                </span>
              )}
            </li>
          ))}
        </ul>
      </figure>
    </TooltipProvider>
  );
}
