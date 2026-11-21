import type { ReactNode } from 'react';

import { ErrorScreen, OffPiste, StoppedLift } from '@comparator/ui/components/error-screen';
import { PageHeader } from '@comparator/ui/components/page-header';
import { Signature } from '@comparator/ui/components/signature';
import { Button } from '@comparator/ui/components/ui/button';

/**
 * The frame of a page that has only a message (an error, the password): the header, the message in the middle of
 * what is left, and the signature. `busy`: the message is still to come.
 */
export function MessagePage({
  title,
  busy = false,
  children,
}: {
  title: string;
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col">
      <div className="page-frame py-4">
        <PageHeader title={title} />
      </div>
      <main className="page-frame flex min-h-0 flex-1" aria-busy={busy}>
        {children}
      </main>
      <footer className="page-frame py-2">
        <Signature />
      </footer>
    </div>
  );
}

/** 404: the address leads nowhere. The way out is the start page. */
export function NotFoundPage() {
  return (
    <MessagePage title="Page not found">
      <ErrorScreen
        picture={<OffPiste className="w-60" />}
        title="Off the marked runs."
        line="This page is not on the map."
      >
        <Button asChild>
          {/* A plain link: the start page is loaded afresh. */}
          <a href="/">Back to the start</a>
        </Button>
      </ErrorScreen>
    </MessagePage>
  );
}

/** 5xx: the page broke on our side. The way out is to try again. */
export function FailurePage({ onRetry }: { onRetry: () => void }) {
  return (
    <MessagePage title="Something went wrong">
      <ErrorScreen
        picture={<StoppedLift className="w-60" />}
        title="The lift is stopped."
        line="Something broke on our side. Try again in a moment."
      >
        <Button onClick={onRetry}>Try again</Button>
      </ErrorScreen>
    </MessagePage>
  );
}
