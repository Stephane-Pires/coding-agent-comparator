import type { ThreadEvent } from '@openai/codex-sdk';

import type { RunEvent } from '@comparator/domain';

/**
 * Translates one event of Codex's stream into run events. Pure: no state between events.
 * Anything this slice does not show yet (commands, file changes, web searches) translates to nothing.
 * A top-level `error` event is dropped too: Codex emits it while it retries, and `turn.failed` has the last word.
 */
export function translate(event: ThreadEvent): RunEvent[] {
  switch (event.type) {
    case 'item.completed':
      return event.item.type === 'agent_message' && event.item.text.trim() !== ''
        ? [{ kind: 'message', text: event.item.text }]
        : [];
    case 'turn.completed':
      return [{ kind: 'finished', outcome: { status: 'succeeded' } }];
    case 'turn.failed':
      return [{ kind: 'finished', outcome: { status: 'failed', reason: event.error.message } }];
    default:
      return [];
  }
}
