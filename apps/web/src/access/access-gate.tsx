'use client';

import { useActionState, useEffect, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';

import { PasswordGate } from '@comparator/ui/components/password-gate';

import { MessagePage } from '../errors/error-page.tsx';
import { api } from '../lib/api.ts';

/** `checking`: the API has not said yet. `out`: the password is needed. `in`: the app can be shown. */
type AccessState = 'checking' | 'out' | 'in';

/** The time the padlock takes to open (`styles.css`, `padlock-open`), before the page changes. */
const PADLOCK_OPENS_MS = 240;

/**
 * Opens the app: the browser fades the password page into it, unless it cannot or the person asked for less
 * motion. React must have drawn the app by the time the browser pictures it, hence `flushSync`.
 */
function openTheApp(open: () => void, isMotionReduced: boolean) {
  if (isMotionReduced || typeof document.startViewTransition !== 'function') {
    open();
    return;
  }
  document.startViewTransition(() => flushSync(open));
}

/**
 * Shows the app only to a browser the API allows. The API decides: this asks it once, when the page loads, and
 * shows the password form when the answer is no. Until the answer comes, only the header is shown, so the app
 * never appears before the form.
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccessState>('checking');
  const [failure, setFailure] = useState<unknown>();
  const [isOpened, setIsOpened] = useState(false);
  useEffect(() => {
    let current = true;
    api.access.get().then(
      ({ isAllowed }) => current && setState(isAllowed ? 'in' : 'out'),
      (error: unknown) => current && setFailure(error),
    );
    return () => {
      current = false;
    };
  }, []);
  const [error, enter, isPending] = useActionState(async (_previous: string | undefined, form: FormData) => {
    const password = form.get('password');
    const { isAllowed } = await api.access.enter({ password: typeof password === 'string' ? password : '' });
    if (!isAllowed) return 'That is not the password. Check it and try again.';
    // The padlock opens, then the locker gives way to the app.
    setIsOpened(true);
    const isMotionReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!isMotionReduced) await new Promise((resolve) => setTimeout(resolve, PADLOCK_OPENS_MS));
    openTheApp(() => setState('in'), isMotionReduced);
    return undefined;
  }, undefined);

  // The API cannot be reached: the page for a failure on our side takes over (`app/error.tsx`).
  if (failure !== undefined) throw failure;
  if (state === 'in') return children;
  return (
    <MessagePage title={state === 'out' ? 'Password' : 'Compare coding agents'} isBusy={state === 'checking'}>
      {state === 'out' && (
        <PasswordGate action={enter} error={error} isPending={isPending} isOpened={isOpened} />
      )}
    </MessagePage>
  );
}
