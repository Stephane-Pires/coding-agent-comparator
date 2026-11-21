import { expect, test, type Page } from '@playwright/test';

// The same tests run on recorded runs and on the real agents (see playwright.e2e.config.ts). So they look at what
// holds for any run, not at an agent's exact words: a status, a file, a row of numbers.
const live = process.env['E2E_RUNTIME'] === 'local';
const AGENTS = ['Claude Code', 'Codex'];
// `pnpm test:e2e:film`: the test is slowed down and filmed, for a person to watch afterwards.
const filmed = process.env['E2E_FILM'] === '1';

test.afterEach(async ({ page }, testInfo) => {
  if (!filmed) return;
  // Time to read the last state, then the video under the test's own name: a file's video is complete only once
  // its page is closed.
  await page.waitForTimeout(2500);
  await page.close();
  const name = testInfo.title
    .split(':')[0]
    ?.replaceAll(/[^a-z0-9]+/gi, '-')
    .toLowerCase();
  await page.video()?.saveAs(`e2e-videos/${name}.webm`);
});

/** The column of one agent's run. */
const column = (page: Page, agent: string) => page.locator(`section[aria-label="${agent}"]`).first();

async function send(page: Page, task: string) {
  await page.goto('/');
  await page.getByRole('textbox').fill(task);
  await page.getByRole('button', { name: 'Send' }).click();
}

test('a task runs on both agents: each shows what it did, the file it left, and its numbers', async ({
  page,
}) => {
  await send(page, 'Create hello.mjs that prints hi, then run it.');

  for (const agent of AGENTS) {
    const run = column(page, agent);
    await expect(run.getByRole('status').first()).toHaveText('Finished');
    // What the agent did: at least one tool call that ended.
    await expect(run.getByText('Done').first()).toBeVisible();
    // What it left.
    await expect(run.getByRole('treeitem', { name: 'hello.mjs' })).toBeVisible();
  }

  // Once both have ended, the runs in numbers.
  const numbers = page.getByRole('table');
  for (const row of ['Model', 'Duration', 'Input tokens', 'Tool calls', 'Files'])
    await expect(numbers.getByRole('row', { name: row })).toBeVisible();
  await expect(numbers.getByRole('row', { name: 'Model' })).not.toContainText('Not reported');
  await expect(numbers.getByRole('row', { name: 'Files' })).not.toContainText('0');

  // A file opens in the viewer, with its content.
  const claude = column(page, 'Claude Code');
  await claude.getByRole('treeitem', { name: 'hello.mjs' }).click();
  await expect(claude.locator('.monaco-editor .view-line').first()).toContainText('console.log');
});

test('a task that is not a coding task starts no run, and says why', async ({ page }) => {
  await send(page, 'hello');
  await expect(page.getByText('Not started')).toBeVisible();
  for (const agent of AGENTS) await expect(column(page, agent)).toHaveCount(0);
});

test('an agent that stops without doing the task ends as incomplete, with what is missing', async ({
  page,
}) => {
  // How a real agent takes this task changes from day to day: only its recording is checked.
  test.skip(live, 'depends on how the agents answer that day');
  await send(page, 'Add unit tests to the existing project.');
  for (const agent of AGENTS) {
    const run = column(page, agent);
    await expect(run.getByRole('status').first()).toHaveText('Incomplete');
    // The reviewer's sentence, in grey under what the agent said.
    await expect(run.locator(':scope > p.text-muted-foreground')).not.toBeEmpty();
  }
  // Nothing to celebrate and nobody is fastest.
  await expect(page.getByRole('table')).not.toContainText('Fastest');
  await expect(page.locator('.snowflake')).toHaveCount(0);
});
