import { useEffect, useRef, useState, type CSSProperties, type UIEvent, type WheelEvent } from 'react';

import type { AgentId, RunStatus, Tool, ToolCall } from '@comparator/contracts';
import { AGENT_LABELS } from '@comparator/ui/agents';
import { getFastest, seconds } from '@comparator/ui/components/comparison-metrics';
import { RUN_STATUSES } from '@comparator/ui/components/run-status-badge';
import { TOOL_CALL_STATUSES, getTitle } from '@comparator/ui/components/tool-call-row';
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
const TICK_EVERY_SECONDS = 5;
/**
 * How fast the slope glides to follow the runs: at least a little faster than the tracks grow, and faster still
 * when the end is far, so it catches up without a jump.
 */
const GLIDE_MIN_PX_PER_SECOND = PX_PER_SECOND * 1.5;
/** The share of the distance left that the glide covers in a second. */
const GLIDE_CATCH_UP_PER_SECOND = 6;
const TRACK_ROW = 'flex h-6 items-center';
/** A gate's look: hollow while its call runs, filled once done, grey when it failed. */
const GATE_STYLES: Record<ToolCall['status'], string> = {
  running: 'border-brand bg-card',
  succeeded: 'border-brand bg-brand',
  failed: 'border-muted-foreground bg-muted-foreground',
};

/**
 * How far the course is drawn, in milliseconds: to the furthest point any run reached, and a little ahead while
 * one still lasts.
 */
export function getCourseLength(now: number, endedAt: readonly (number | undefined)[]): number {
  const isRunning = endedAt.some((end) => end === undefined);
  const furthest = Math.max(isRunning ? now : 0, ...endedAt.map((end) => end ?? 0));
  return furthest + (isRunning ? AHEAD_MS : 0);
}

const pluralize = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** A run in words, for who cannot see its track: in the words of its badge. */
function describeTrack({ agent, status, gates, durationMs }: RunTrack): string {
  const calls = pluralize(gates.length, 'tool call');
  if (status === 'running') return `${AGENT_LABELS[agent]}: running, ${calls} so far.`;
  const time = durationMs === undefined ? '' : ` in ${seconds.format(durationMs / 1000)} seconds`;
  return `${AGENT_LABELS[agent]}: ${RUN_STATUSES[status].label.toLowerCase()}${time}, ${calls}.`;
}

const toPixels = (time: number) => (time / 1000) * PX_PER_SECOND;

/** The icon at the end of a track: a flag for a run that finished, its status icon for any other end. */
function getEndIcon(status: RunStatus) {
  if (status === 'running') return null;
  if (status === 'succeeded') return ICONS.finish;
  return ICONS.run[status];
}

/**
 * A gate: where a tool call started. Hollow while the call runs, filled once done, grey when it failed. Pointed
 * at, it says when exactly, what was called, and how it stands. The same call is a row of the run's column, which
 * is where a keyboard or a screen reader finds it.
 */
function Gate({ gate, style }: { gate: TrackGate; style: CSSProperties }) {
  const { text, isCode, before } = getTitle(gate.tool);
  const ToolIcon = ICONS.tool[gate.tool.type];
  const { label, tone } = TOOL_CALL_STATUSES[gate.status];
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
            className={`size-2.5 rotate-45 border-2 ring-2 ring-card ${GATE_STYLES[gate.status]}`}
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
          <span className={`line-clamp-3 min-w-0 break-all ${isCode ? 'font-mono' : ''}`}>{text}</span>
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

/** One run on the course: the part of the track it has skied, its gates, and where it stands or ended. */
function Track({ track, now }: { track: RunTrack; now: number }) {
  const { status, gates, endedAt } = track;
  // A mark stands at its time by being moved, not laid out again: centred on it, or starting from it.
  const centreAt = (time: number) => ({ translate: `calc(${toPixels(time)}px - 50%) -50%` });
  const startAt = (time: number) => ({ translate: `${toPixels(time)}px -50%` });
  // Where the track ends: at its end once the run is over. While it lasts, at the clock, or at its
  // last gate if that one came since the clock last ticked: a gate is never ahead of its track.
  const head = endedAt ?? Math.max(now, ...gates.map((gate) => gate.at));
  const EndIcon = getEndIcon(status);
  return (
    <div className={`${TRACK_ROW} relative`}>
      {/* the course ahead, then the part of it already skied */}
      <span className="run-course" />
      <span className="run-track" style={{ clipPath: `inset(0 calc(100% - ${toPixels(head)}px) 0 0)` }} />
      {/* a gate per tool call: hollow while it runs, filled once done, grey when it failed */}
      {gates.map((gate) => (
        <Gate key={gate.id} gate={gate} style={centreAt(gate.at)} />
      ))}
      {status === 'running' ? (
        <span
          className="run-mark absolute top-1/2 left-0 size-3 rounded-full border-2 border-brand bg-card"
          style={centreAt(head)}
        />
      ) : null}
      {EndIcon ? (
        <span className="run-mark run-arrival absolute top-1/2 left-0 bg-card pl-1" style={startAt(head)}>
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
  const fastest = getFastest(tracks);
  const length = getCourseLength(
    now,
    tracks.map(({ endedAt }) => endedAt),
  );
  const ticks = Array.from(
    { length: Math.floor(length / 1000 / TICK_EVERY_SECONDS) + 1 },
    (_, tick) => tick * TICK_EVERY_SECONDS,
  );

  // The slope follows the furthest run. It stops when the person scrolls it sideways themselves, and follows again
  // once they bring it back to its end. Scrolling the page up and down over it changes nothing.
  const slope = useRef<HTMLDivElement>(null);
  const [isFollowing, setIsFollowing] = useState(true);
  const edge = toPixels(length);
  useEffect(() => {
    const view = slope.current;
    if (!view || !isFollowing) return undefined;
    const end = () => edge - view.clientWidth;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (end() > view.scrollLeft) view.scrollLeft = end();
      return undefined;
    }
    // A glide, drawn every frame. The position is kept here, since the browser rounds the one it holds.
    let position = view.scrollLeft;
    let last = performance.now();
    let frame = requestAnimationFrame(function glide(time: number) {
      const gap = end() - position;
      if (gap <= 0) return;
      const pace = Math.max(GLIDE_MIN_PX_PER_SECOND, gap * GLIDE_CATCH_UP_PER_SECOND);
      position += Math.min(gap, (pace * (time - last)) / 1000);
      last = time;
      view.scrollLeft = position;
      frame = requestAnimationFrame(glide);
    });
    return () => cancelAnimationFrame(frame);
  }, [edge, isFollowing]);
  const onWheel = (event: WheelEvent) => {
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) setIsFollowing(false);
  };
  const onScroll = ({ currentTarget: view }: UIEvent<HTMLDivElement>) => {
    if (view.scrollLeft + view.clientWidth >= view.scrollWidth - PX_PER_SECOND) setIsFollowing(true);
  };
  const takeOver = () => setIsFollowing(false);

  return (
    <TooltipProvider delayDuration={100}>
      <figure className="@container flex gap-3 rounded-lg border bg-card p-4 text-sm">
        <figcaption className="sr-only">The runs over time</figcaption>
        <ul className="flex shrink-0 flex-col gap-2 font-medium">
          {tracks.map((track) => {
            const AgentIcon = ICONS.agent[track.agent];
            return (
              <li key={track.agent} className={`${TRACK_ROW} gap-2`}>
                <span className="sr-only">{describeTrack(track)}</span>
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
                <span
                  key={tick}
                  className="absolute left-0"
                  style={{ translate: `${toPixels(tick * 1000)}px` }}
                >
                  {tick} s
                </span>
              ))}
            </p>
          </div>
        </div>
        {/* Its width is kept from the start: a time that arrives takes no room from the tracks. */}
        <ul aria-hidden="true" className="flex w-28 shrink-0 flex-col gap-2 text-right tabular-nums">
          {tracks.map(({ agent, status, durationMs }) => (
            <li key={agent} className={`${TRACK_ROW} justify-end`}>
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
