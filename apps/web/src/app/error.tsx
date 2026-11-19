'use client';

import { FailurePage } from '../errors/error-page.tsx';

/** Shown in place of a page that threw while rendering. `reset` renders it again. */
export default function PageError({ reset }: { reset: () => void }) {
  return <FailurePage onRetry={reset} />;
}
