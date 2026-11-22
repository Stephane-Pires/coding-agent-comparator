import type { RunChunk } from '@comparator/contracts';
import { isAccessRefused, isRateLimited, type RunEvent, type RunOutcome } from '@comparator/domain';

/**
 * What a visitor is told when the app's own access to a provider was refused. The provider's words are for
 * whoever holds the key: they name an account, sometimes part of a key, and tell the reader to fix what a visitor
 * cannot. Every other failure is shown in the agent's own words.
 */
export const ACCESS_REFUSED =
  "This agent could not start: the app's access to its provider was refused. It is a problem with this app, not with your task. Tell whoever runs it.";

/** What a visitor is told when a provider is limiting requests for now. */
export const RATE_LIMITED =
  'This agent could not finish: its provider is receiving too many requests right now. Wait a minute, then send the task again.';

/**
 * The outcome as a visitor sees it. A refusal of the app, or a provider limiting requests, is said plainly; the
 * provider's real words go to `log`.
 */
function getShownOutcome(outcome: RunOutcome, log: (line: string) => void): RunOutcome {
  if (outcome.status !== 'failed') return outcome;
  if (isAccessRefused(outcome.reason)) {
    log(`A provider refused the app's access. Its words: ${outcome.reason}`);
    return { status: 'failed', reason: ACCESS_REFUSED };
  }
  if (isRateLimited(outcome.reason)) {
    log(`A provider is limiting requests. Its words: ${outcome.reason}`);
    return { status: 'failed', reason: RATE_LIMITED };
  }
  return outcome;
}

/** Presents a run as the chunks of the API's stream: each message becomes a text part; each tool call, each file, the totals and the end a data part. */
export async function* present(
  events: AsyncIterable<RunEvent>,
  log: (line: string) => void = console.error,
): AsyncGenerator<RunChunk, void, void> {
  yield { type: 'start' };
  let messages = 0;
  for await (const event of events) {
    switch (event.kind) {
      case 'message': {
        const id = `message-${++messages}`;
        yield { type: 'text-start', id };
        yield { type: 'text-delta', id, delta: event.text };
        yield { type: 'text-end', id };
        break;
      }
      case 'tool-call':
        // The call's own id: a later chunk for the same call replaces the earlier one on the client.
        yield { type: 'data-tool-call', id: event.call.id, data: event.call };
        break;
      case 'file':
        // The file's path: a later chunk for the same file replaces the earlier one on the client.
        yield { type: 'data-file', id: event.file.path, data: event.file };
        break;
      case 'metrics':
        yield { type: 'data-metrics', data: event.metrics };
        break;
      case 'finished':
        yield { type: 'data-outcome', data: getShownOutcome(event.outcome, log) };
        break;
    }
  }
  yield { type: 'finish' };
}
