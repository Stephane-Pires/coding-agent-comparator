import {
  ArrowUp,
  Ban,
  Check,
  ChevronDown,
  CircleCheck,
  CircleX,
  Globe,
  Hexagon,
  LoaderCircle,
  Sparkle,
  Square,
  SquareTerminal,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';

import type { AgentId, RunStatus, Tool, ToolCall } from '@comparator/contracts';

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
  tool: {
    command: SquareTerminal,
    'web-search': Globe,
    other: Wrench,
  } satisfies Record<Tool['type'], LucideIcon>,
  toolCall: {
    running: LoaderCircle,
    succeeded: Check,
    failed: X,
  } satisfies Record<ToolCall['status'], LucideIcon>,
  expand: ChevronDown,
  send: ArrowUp,
  stop: Square,
};
