// Every story of the design system, in light and in dark, has no accessibility violation (axe, WCAG 2.1 A and AA).
// The list of stories is read from the built Storybook, so a new story is checked without touching this file.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

interface StoryIndex {
  entries: Record<string, { id: string; title: string; name: string; type: string }>;
}

const INDEX = join(import.meta.dirname, '../../packages/ui/storybook-static/index.json');
const index = JSON.parse(readFileSync(INDEX, 'utf8')) as StoryIndex;
const stories = Object.values(index.entries).filter((entry) => entry.type === 'story');

for (const story of stories) {
  for (const theme of ['light', 'dark']) {
    test(`${story.title} / ${story.name} (${theme})`, async ({ page }) => {
      await page.goto(`/iframe.html?id=${story.id}&viewMode=story&globals=theme:${theme}`);
      await page.locator('#storybook-root > *').first().waitFor();
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(
        violations.map(({ id, help, nodes }) => ({ id, help, on: nodes.map((node) => node.html) })),
      ).toEqual([]);
    });
  }
}
