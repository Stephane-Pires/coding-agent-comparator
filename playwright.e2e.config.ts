import { defineConfig, devices } from '@playwright/test';

// Drives the real page in a browser, on a production build of the web app and on the API. `pnpm test:e2e` runs it on
// recordings, `:live` on the real agents, `:sandbox` on them in Vercel Sandboxes, `:film` saves a video of each test.
// What runs the tasks: recordings unless told otherwise.
const runtime = process.env['E2E_RUNTIME'] ?? 'recorded';
const isLive = runtime !== 'recorded';
// Filmed for a person to watch afterwards: each action is followed by a pause, the recorded agents report their
// steps slowly, and a video is kept (see tooling/e2e/app.spec.ts). No window is shown: a film of a visible window
// depends on the screen and the window tools of whoever runs it.
const isFilmed = process.env['E2E_FILM'] === '1';
// The ports the tests start their own API and web app on. They are apart from a dev server's (3001 and 3100), so
// both can run at once; set these two variables if something else already holds them.
const API_PORT = process.env['E2E_API_PORT'] ?? '3011';
const WEB_PORT = process.env['E2E_WEB_PORT'] ?? '3110';
// The tests run the app as it is hosted: behind its password.
export const PASSWORD = 'a password for the tests';
const API = `http://127.0.0.1:${API_PORT}`;
const WEB = `http://127.0.0.1:${WEB_PORT}`;

/** How long one test may take: a real agent takes its time, and a filmed recording is slowed down for a person. */
function getTestTimeoutMs(): number {
  if (isLive) return 300_000;
  if (isFilmed) return 120_000;
  return 30_000;
}

export default defineConfig({
  testDir: 'tooling/e2e',
  testMatch: '*.spec.ts',
  timeout: getTestTimeoutMs(),
  expect: { timeout: isLive ? 240_000 : 10_000 },
  // One comparison at a time: the live agents share a machine and an account.
  workers: 1,
  reporter: [['list']],
  metadata: { api: API },
  use: {
    baseURL: WEB,
    trace: 'retain-on-failure',
    launchOptions: { slowMo: isFilmed ? 700 : 0 },
    // A filmed run is recorded at the size of the page; any other run keeps a video only when it fails.
    video: isFilmed ? { mode: 'on', size: { width: 1280, height: 720 } } : 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node apps/server/src/main.ts',
      env: {
        PORT: API_PORT,
        AGENT_RUNTIME: runtime,
        DEMO_PASSWORD: PASSWORD,
        // How far apart a recorded agent's steps are, for a person watching the film: slow enough to read.
        ...(isFilmed ? { RECORDED_PACE_MS: '700' } : {}),
      },
      url: `${API}/openapi.json`,
      reuseExistingServer: false,
    },
    {
      command: `pnpm --filter @comparator/web build && pnpm --filter @comparator/web exec next start --port ${WEB_PORT}`,
      // Where the API is belongs to the build: the web app forwards its calls there.
      env: { API_URL: API },
      url: WEB,
      timeout: 180_000,
      reuseExistingServer: false,
    },
  ],
});
