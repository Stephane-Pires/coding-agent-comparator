import { defineConfig, devices } from '@playwright/test';

// Checks the design system's stories (built by `build-storybook`): accessibility with axe on every story, in light
// and in dark. Run with `pnpm test:stories`.
export default defineConfig({
  testDir: 'tooling/storybook',
  testMatch: '*.spec.ts',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:6007', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command:
      'pnpm --filter @comparator/ui exec vite preview --outDir storybook-static --port 6007 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:6007/index.json',
    reuseExistingServer: false,
  },
});
