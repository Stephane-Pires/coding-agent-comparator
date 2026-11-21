import { expect, test, type Page } from '@playwright/test';

import { PASSWORD } from '../../playwright.e2e.config.ts';

// The same tests run on recorded runs and on the real agents (see playwright.e2e.config.ts). So they look at what
// holds for any run, not at an agent's exact words: a status, a file, a row of numbers.
const live = (process.env['E2E_RUNTIME'] ?? 'recorded') !== 'recorded';
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

const TASK_FIELD = 'Task for the agents';

/** The column of one agent's run. */
const column = (page: Page, agent: string) => page.locator(`section[aria-label="${agent}"]`).first();

/** Gives the password, as a person would on a first visit. */
async function enter(page: Page) {
  await page.goto('/');
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Enter' }).click();
  // By its name: the password field is a text box too.
  await expect(page.getByRole('textbox', { name: TASK_FIELD })).toBeVisible();
}

async function send(page: Page, task: string) {
  await enter(page);
  await page.getByRole('textbox', { name: TASK_FIELD }).fill(task);
  await page.getByRole('button', { name: 'Send' }).click();
}

test('a task runs on both agents: each shows what it did, the file it left, and its numbers', async ({
  page,
}) => {
  await send(page, 'Create hello.mjs that prints hi, then run it.');

  for (const agent of AGENTS) {
    const run = column(page, agent);
    await expect(run.getByRole('status').first()).toHaveText('Finished');
    // Its track on the slope: it reached the finish.
    await expect(page.getByRole('figure', { name: 'The runs over time' })).toContainText(
      `${agent}: finished`,
    );
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

test('the password: no call works without it, a wrong one says so, and the right one opens the app', async ({
  page,
  request,
}, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'The ski locker is locked.' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: TASK_FIELD })).toHaveCount(0);
  // Through the app or straight to the API's own address: a call that would spend the keys is refused.
  const api = String(testInfo.config.metadata['api']);
  const task = { task: 'Write a script.' };
  expect((await request.post('/rpc/tasks/check', { data: { json: task } })).status()).toBe(401);
  expect((await request.post(`${api}/api/tasks/check`, { data: task })).status()).toBe(401);
  // A program gives the password with its call.
  const withPassword = { data: task, headers: { authorization: `Bearer ${PASSWORD}` } };
  expect((await request.post(`${api}/api/tasks/check`, withPassword)).status()).toBe(200);

  await page.getByLabel('Password', { exact: true }).fill('not the password');
  // The eye shows what was typed, and hides it again.
  await page.getByRole('button', { name: 'Show the password' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide the password' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Enter' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'That is not the password' })).toBeVisible();

  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Enter' }).click();
  await expect(page.getByRole('textbox', { name: TASK_FIELD })).toBeVisible();
  // The pass is kept: the page loaded again goes straight to the app.
  await page.reload();
  await expect(page.getByRole('textbox', { name: TASK_FIELD })).toBeVisible();
});
