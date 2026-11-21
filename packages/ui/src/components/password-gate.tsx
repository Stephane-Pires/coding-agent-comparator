import { useId, useState, type ComponentProps, type SVGProps } from 'react';

import { Button } from '@comparator/ui/components/ui/button';
import { Input } from '@comparator/ui/components/ui/input';
import { ICONS } from '@comparator/ui/icons';

/**
 * For the password page: a row of ski lockers in the snow, a padlock on the middle one, and a pair of skis left
 * leaning against the side. The padlock shakes once when `refused` becomes true: the answer to a wrong password.
 */
export function SkiLocker({ refused = false, ...props }: SVGProps<SVGSVGElement> & { refused?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120" aria-hidden="true" {...props}>
      <path className="fill-muted" d="M0 120V104Q60 96 120 100T240 98V120Z" />
      {/* a ski pole planted on the left, and the pair of skis on the right, tips up */}
      <g className="stroke-muted-foreground/70" fill="none" strokeWidth="2" strokeLinecap="round">
        <path d="M58 103L66 40M54 95H64" />
      </g>
      <g className="stroke-muted-foreground" fill="none" strokeWidth="3" strokeLinecap="round">
        <path d="M180 102L172 28Q171 21 166 20M190 102L182 32Q181 25 176 24" />
      </g>
      {/* the lockers: one frame, three doors, the snow that settled on top */}
      <path className="fill-muted-foreground/25" d="M74 31Q78 22 96 24T138 22T166 31Z" />
      <rect
        className="fill-background stroke-muted-foreground"
        x="76"
        y="30"
        width="88"
        height="74"
        rx="4"
        strokeWidth="2"
      />
      <g className="stroke-muted-foreground" fill="none" strokeWidth="2" strokeLinecap="round">
        <path d="M105 30V104M135 30V104" />
      </g>
      {/* the vents of each door, and the handles of the two that are not locked */}
      <g className="stroke-muted-foreground/60" fill="none" strokeWidth="2" strokeLinecap="round">
        <path d="M84 40H97M84 45H97M84 50H97M114 40H126M114 45H126M114 50H126M143 40H156M143 45H156M143 50H156" />
        <path d="M98 66V76M142 66V76" />
      </g>
      {/* the padlock */}
      <g className={refused ? 'padlock-refused' : undefined}>
        <path
          className="stroke-brand"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          d="M114 70V65a6 6 0 0 1 12 0V70"
        />
        <rect className="fill-brand" x="110" y="70" width="20" height="16" rx="3" />
        <circle className="fill-background" cx="120" cy="77" r="2.5" />
      </g>
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
  // The password is hidden as it is typed; the eye shows it, to check it before sending.
  const [shown, setShown] = useState(false);
  const Reveal = shown ? ICONS.reveal.hide : ICONS.reveal.show;
  const reveal = shown ? 'Hide the password' : 'Show the password';
  return (
    <div className="flex size-full flex-col items-center justify-center gap-3 p-8 text-center">
      {/* Not while the password is checked: a second wrong one makes the padlock shake again. */}
      <SkiLocker className="w-60" refused={error !== undefined && !pending} />
      <h2 className="text-lg font-medium">The ski locker is locked.</h2>
      <p className="text-sm text-muted-foreground">This app is private. Enter its password to start a run.</p>
      <form action={action} className="mt-2 flex w-full max-w-xs flex-col gap-2 text-left">
        <label htmlFor={`${id}-password`} className="text-sm font-medium">
          Password
        </label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Input
              id={`${id}-password`}
              name="password"
              type={shown ? 'text' : 'password'}
              autoComplete="current-password"
              autoFocus
              required
              className="pr-8"
              aria-invalid={error !== undefined}
              aria-describedby={error === undefined ? undefined : `${id}-error`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-0 right-0 text-muted-foreground hover:bg-transparent hover:text-foreground dark:hover:bg-transparent"
              aria-label={reveal}
              title={reveal}
              aria-pressed={shown}
              onClick={() => setShown((now) => !now)}
            >
              <Reveal />
            </Button>
          </div>
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
