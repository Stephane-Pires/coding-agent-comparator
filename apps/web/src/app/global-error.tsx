'use client';

import { FailurePage } from '../errors/error-page.tsx';

import './globals.css';

/** Shown when the layout itself threw: it replaces the whole document, so it brings its own. */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <FailurePage onRetry={reset} />
      </body>
    </html>
  );
}
