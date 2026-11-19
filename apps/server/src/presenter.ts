import type { RunChunk } from '@comparator/contracts';
import type { RunEvent } from '@comparator/domain';

/** Presents a run as the chunks of the API's stream: each message becomes a text part, the end an outcome. */
export async function* present(events: AsyncIterable<RunEvent>): AsyncGenerator<RunChunk, void, void> {
  yield { type: 'start' };
  let messages = 0;
  for await (const event of events) {
    if (event.kind === 'message') {
      const id = `message-${++messages}`;
      yield { type: 'text-start', id };
      yield { type: 'text-delta', id, delta: event.text };
      yield { type: 'text-end', id };
    } else {
      yield { type: 'data-outcome', data: event.outcome };
    }
  }
  yield { type: 'finish' };
}
