import {
  ArrowUp,
  Ban,
  CircleCheck,
  CircleX,
  Hexagon,
  LoaderCircle,
  Sparkle,
  Square,
  type LucideIcon,
} from 'lucide-react';

import type { AgentId, RunStatus } from '@comparator/contracts';

/**
 * One icon per concept, the same everywhere (docs/design/look-and-feel.md, Icons).
 * Add a concept here before using a new icon.
 */
export const ICONS = {
  agent: { 'claude-code': Sparkle, codex: Hexagon } satisfies Record<AgentId, LucideIcon>,
  run: {
    running: LoaderCircle,
    succeeded: CircleCheck,
    failed: CircleX,
    cancelled: Ban,
  } satisfies Record<RunStatus, LucideIcon>,
  send: ArrowUp,
  stop: Square,
};
