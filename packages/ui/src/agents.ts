import type { AgentId } from '@comparator/contracts';

/** The name each agent is shown under. Adding an agent to the domain fails the type check here until it has one. */
export const AGENT_LABELS = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
} satisfies Record<AgentId, string>;
