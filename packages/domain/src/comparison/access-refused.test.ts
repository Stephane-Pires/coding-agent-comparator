import { describe, expect, it } from 'vite-plus/test';

import { accessRefused } from './access-refused.ts';

describe('accessRefused', () => {
  it.each([
    // Seen on 2026-11-21, with keys the providers did not know.
    'Invalid API key · Fix external API key',
    'unexpected status 401 Unauthorized: Incorrect API key provided: sk-proj-**********-key. You can find your API key at https://platform.openai.com/account/api-keys., auth error code: invalid_api_key',
    // Seen in the spike, in a sandbox with no credential.
    'Not logged in · Please run /login',
    'unexpected status 401 Unauthorized: Missing bearer or basic authentication in header',
    // The providers' documented words for an account with nothing left; not seen here.
    'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.',
    'You exceeded your current quota, please check your plan and billing details. (insufficient_quota)',
  ])('recognises a refusal of the app itself: %s', (reason) => {
    expect(accessRefused(reason)).toBe(true);
  });

  it.each([
    'The agent stopped without reporting a result.',
    'The run was stopped after 240 seconds, the longest a run may last on the hosted app.',
    'npm test failed: expected 401 but the server answered 200',
    'The agent exited with code 1.',
  ])('leaves an ordinary failure alone: %s', (reason) => {
    expect(accessRefused(reason)).toBe(false);
  });
});
