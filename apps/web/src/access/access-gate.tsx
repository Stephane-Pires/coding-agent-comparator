'use client';

import { useActionState, useEffect, useState, type ReactNode } from 'react';

import { PageHeader } from '@comparator/ui/components/page-header';
import { PasswordGate } from '@comparator/ui/components/password-gate';
import { Signature } from '@comparator/ui/components/signature';

import { api } from '../lib/api.ts';
import { reducedMotion, withViewTransition } from '../lib/view-transition.ts';

/** The time the padlock takes to open (`styles.css`, `padlock-open`), before the page changes. */
const PADLOCK_OPENS_MS = 240;

/** `checking`: the API has not said yet. `out`: the password is needed. `in`: the app can be shown. */
type AccessState = 'checking' | 'out' | 'in';

/**
 * Shows the app only to a browser the API allows. The API decides: this asks it once, when the page loads, and
 * shows the password form when the answer is no. Until the answer comes, only the header is shown, so the app
 * never appears before the form.
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccessState>('checking');
  const [failure, setFailure] = useState<unknown>();
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    let current = true;
    api.access.get().then(
      ({ allowed }) => current && setState(allowed ? 'in' : 'out'),
      (error: unknown) => current && setFailure(error),
    );
    return () => {
      current = false;
    };
  }, []);
  const [error, enter, pending] = useActionState(async (_previous: string | undefined, form: FormData) => {
    const password = form.get('password');
    const { allowed } = await api.access.enter({ password: typeof password === 'string' ? password : '' });
    if (!allowed) return 'That is not the password. Check it and try again.';
    // The padlock opens, then the locker gives way to the app.
    setOpened(true);
    if (!reducedMotion()) await new Promise((resolve) => setTimeout(resolve, PADLOCK_OPENS_MS));
    withViewTransition(() => setState('in'));
    return undefined;
  }, undefined);

  // The API cannot be reached: the page for a failure on our side takes over (`app/error.tsx`).
  if (failure !== undefined) throw failure;
  if (state === 'in') return children;
  return (
    <div className="flex h-dvh flex-col">
      <div className="page-frame py-4">
        <PageHeader title={state === 'out' ? 'Password' : 'Compare coding agents'} />
      </div>
      <main className="page-frame flex min-h-0 flex-1" aria-busy={state === 'checking'}>
        {state === 'out' && <PasswordGate action={enter} error={error} pending={pending} opened={opened} />}
      </main>
      <footer className="page-frame py-2">
        <Signature />
      </footer>
    </div>
  );
}
