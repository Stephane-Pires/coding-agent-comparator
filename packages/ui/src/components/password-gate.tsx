import { useId, type ComponentProps, type SVGProps } from 'react';

import { Button } from '@comparator/ui/components/ui/button';
import { Input } from '@comparator/ui/components/ui/input';

/** For the password page: the gate at the bottom of a lift, its bar down across the way in. */
export function LiftGate(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120" aria-hidden="true" {...props}>
      <path className="fill-muted" d="M0 120V102Q60 92 120 98T240 94V120Z" />
      {/* the cable and the pylon of the lift, behind the gate */}
      <g className="stroke-muted-foreground/60" fill="none" strokeWidth="2" strokeLinecap="round">
        <path d="M150 20L236 4M196 96V12M188 16H204" />
      </g>
      {/* the two posts of the gate */}
      <g className="stroke-muted-foreground" fill="none" strokeWidth="3" strokeLinecap="round">
        <path d="M84 100V58M156 98V58" />
      </g>
      <g className="fill-muted-foreground">
        <circle cx="84" cy="56" r="4" />
        <circle cx="156" cy="56" r="4" />
      </g>
      {/* the bar, down */}
      <path className="stroke-brand" fill="none" strokeWidth="4" strokeLinecap="round" d="M84 74H156" />
    </svg>
  );
}

/**
 * The whole content of the password page: a picture, what is asked in a few words, one field and one button.
 * A wrong password is said under the field, in a plain sentence.
 */
export function PasswordGate({
  action,
  error,
  pending = false,
}: {
  /** Receives the form; the password is its `password` field. */
  action: ComponentProps<'form'>['action'];
  /** What to say when the password was wrong. */
  error?: string | undefined;
  /** The password is being checked. */
  pending?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex size-full flex-col items-center justify-center gap-3 p-8 text-center">
      <LiftGate className="w-60" />
      <h2 className="text-lg font-medium">Your pass, please.</h2>
      <p className="text-sm text-muted-foreground">This app is private. Enter its password to start a run.</p>
      <form action={action} className="mt-2 flex w-full max-w-xs flex-col gap-2 text-left">
        <label htmlFor={`${id}-password`} className="text-sm font-medium">
          Password
        </label>
        <div className="flex gap-2">
          <Input
            id={`${id}-password`}
            name="password"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            aria-invalid={error !== undefined}
            aria-describedby={error === undefined ? undefined : `${id}-error`}
          />
          <Button type="submit" disabled={pending}>
            {pending ? 'Checking…' : 'Enter'}
          </Button>
        </div>
        {/* Always there, so that a screen reader announces the sentence when it appears. */}
        <p id={`${id}-error`} role="alert" className="min-h-5 text-sm text-destructive">
          {error}
        </p>
      </form>
    </div>
  );
}
