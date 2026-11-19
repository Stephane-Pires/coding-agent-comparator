// Layout spacing stays on the scale (docs/design/look-and-feel.md, Layout): gaps, margins and section padding use
// Tailwind's steps 1 2 3 4 6 8 12 (4 to 48 px) in our own components and pages. Control spacing (padding under
// 12 px, inside a button or a badge) and the library primitives (`components/ui`) keep their own sizes. Two more are
// not spacing: a 2 px margin aligning an icon with the first line of its text (`mt-0.5`), and a value marked by a
// `layout-scale: <why>` comment on one of the three lines above it.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

const ROOT = join(import.meta.dirname, '..');
const DIRS = ['packages/ui/src', 'apps/web/src'];
/** What shadcn and AI Elements generate: library code, with its own sizes. */
const GENERATED = ['packages/ui/src/components/ui', 'packages/ui/src/components/ai-elements'];
const SCALE = new Set(['0', '1', '2', '3', '4', '6', '8', '12', 'px', 'auto']);

/** A class like `gap-1.5`, `-mt-0.5`, `@cols-8:px-[3px]`, `sm:space-y-5`: its utility and its value. */
const SPACING =
  /(?<![\w-])-?(gap(?:-[xy])?|space-[xy]|m[xytblrse]?|p[xytblrse]?)-(\[[^\]\s]+\]|[0-9.]+|px|auto)(?![\w.[-])/g;

function files(dir: string): string[] {
  if (!existsSync(dir) || GENERATED.includes(relative(ROOT, dir))) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : files(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Off-scale layout spacing in a source: `utility-value` for each, padding under 12 px left out (control spacing). */
export function offScale(code: string): string[] {
  const lines = code.split('\n');
  return lines.flatMap((line, i) => {
    if (lines.slice(Math.max(0, i - 3), i + 1).some((l) => l.includes('layout-scale:'))) return [];
    return [...line.matchAll(SPACING)]
      .filter(([, utility = '', value = '']) => {
        if (SCALE.has(value)) return false;
        if (utility.startsWith('m') && value === '0.5') return false; // optical alignment of an icon
        const padding = utility.startsWith('p');
        return !(padding && /^[0-9.]+$/.test(value) && Number(value) < 3);
      })
      .map(([match]) => match);
  });
}

describe('layout spacing', () => {
  it('reads gaps, margins and section padding; leaves control padding and scale values alone', () => {
    expect(
      offScale('flex gap-1.5 mt-2 px-1.5 py-0.5 p-4 @max-cols-8:py-3 -mt-0.5 pl-39 gap-[3px] space-y-5'),
    ).toEqual(['gap-1.5', 'pl-39', 'gap-[3px]', 'space-y-5']);
    expect(offScale('size-3.5 w-20 h-[28rem] grid-cols-[auto_1fr] max-w-prose top-1.5')).toEqual([]);
    expect(offScale('{/* layout-scale: room for the unit */}\n<Input\n  className="pr-20"')).toEqual([]);
  });

  it('skips the generated library components', () => {
    expect(GENERATED.flatMap((dir) => files(join(ROOT, dir)))).toEqual([]);
    expect(files(join(ROOT, 'packages/ui/src')).some((path) => path.includes('/components/ui/'))).toBe(false);
  });

  it('stays on the scale in our components and pages', () => {
    const found = DIRS.flatMap((dir) =>
      files(join(ROOT, dir)).flatMap((path) =>
        offScale(readFileSync(path, 'utf8')).map((c) => `${relative(ROOT, path)}: ${c}`),
      ),
    );
    expect(found).toEqual([]);
  });
});
