import type { RunChunk } from '@comparator/contracts';
import { accessRefused, type RunEvent, type RunOutcome } from '@comparator/domain';

/**
 * What a visitor is told when the app's own access to a provider was refused. The provider's words are for
 * whoever holds the key: they name an account, sometimes part of a key, and tell the reader to fix what a visitor
 * cannot. Every other failure is shown in the agent's own words.
 */
export const ACCESS_REFUSED =
  "This agent could not start: the app's access to its provider was refused. It is a problem with this app, not with your task. Tell whoever runs it.";

/** The outcome as a visitor sees it. A refusal of the app is said plainly, and its real words go to `log`. */
function shown(outcome: RunOutcome, log: (line: string) => void): RunOutcome {
  if (outcome.status !== 'failed' || !accessRefused(outcome.reason)) return outcome;
  log(`A provider refused the app's access. Its words: ${outcome.reason}`);
  return { status: 'failed', reason: ACCESS_REFUSED };
}

/** Presents a run as the chunks of the API's stream: each message becomes a text part; each tool call, each file, the totals and the end a data part. */
export async function* present(
  events: AsyncIterable<RunEvent>,
  log: (line: string) => void = console.error,
): AsyncGenerator<RunChunk, void, void> {
  yield { type: 'start' };
  let messages = 0;
  for await (const event of events) {
    if (event.kind === 'message') {
      const id = `message-${++messages}`;
      yield { type: 'text-start', id };
      yield { type: 'text-delta', id, delta: event.text };
      yield { type: 'text-end', id };
    } else if (event.kind === 'tool-call') {
      // The call's own id: a later chunk for the same call replaces the earlier one on the client.
      yield { type: 'data-tool-call', id: event.call.id, data: event.call };
    } else if (event.kind === 'file') {
      // The file's path: a later chunk for the same file replaces the earlier one on the client.
      yield { type: 'data-file', id: event.file.path, data: event.file };
    } else if (event.kind === 'metrics') {
      yield { type: 'data-metrics', data: event.metrics };
    } else {
      yield { type: 'data-outcome', data: shown(event.outcome, log) };
    }
  }
  yield { type: 'finish' };
}
