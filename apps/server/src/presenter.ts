import type { RunChunk } from '@comparator/contracts';
import type { RunEvent } from '@comparator/domain';

/** Presents a run as the chunks of the API's stream: each message becomes a text part; each tool call, each file and the end a data part. */
export async function* present(events: AsyncIterable<RunEvent>): AsyncGenerator<RunChunk, void, void> {
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
    } else {
      yield { type: 'data-outcome', data: event.outcome };
    }
  }
  yield { type: 'finish' };
}
