import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';

import type { RunEvent } from '@comparator/domain';

/** The model name Claude Code gives to notices it writes itself, such as "Not logged in". */
const SYNTHETIC_MODEL = '<synthetic>';

/**
 * Translates one message of Claude Code's stream into run events. Pure: no state between messages.
 * Anything this slice does not show yet (tool calls, thinking, rate-limit notices) translates to nothing.
 */
export function translate(message: SDKMessage): RunEvent[] {
  if (message.type === 'assistant') {
    // A synthetic notice announces a failure: the `result` that follows carries the same text.
    if (message.message.model === SYNTHETIC_MODEL) return [];
    return message.message.content.flatMap((block): RunEvent[] =>
      block.type === 'text' && block.text.trim() !== '' ? [{ kind: 'message', text: block.text }] : [],
    );
  }
  if (message.type === 'result') {
    // `subtype: 'success'` cannot be trusted alone: a refused model is a "success" with `is_error`.
    if (!message.is_error) return [{ kind: 'finished', outcome: { status: 'succeeded' } }];
    const reason = message.subtype === 'success' ? message.result : message.errors.join('\n');
    return [{ kind: 'finished', outcome: { status: 'failed', reason: reason || message.subtype } }];
  }
  return [];
}
