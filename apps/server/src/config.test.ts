import { describe, expect, it } from 'vite-plus/test';

import { readConfig } from './config.ts';

describe('readConfig', () => {
  it('needs nothing: no key means the agents use the login on the machine', () => {
    expect(readConfig({})._unsafeUnwrap()).toEqual({
      port: 3001,
      password: undefined,
      hosted: false,
      runtime: 'local',
      sandboxRunLimitMs: 240_000,
      recordedPaceMs: 60,
      claudeCode: { model: 'haiku', apiKey: undefined },
      codex: { model: 'gpt-6-luna', apiKey: undefined },
      taskCheck: { model: 'claude-haiku-5-5', apiKey: undefined },
    });
  });

  it('reads the keys, the models and the port', () => {
    const config = readConfig({
      ANTHROPIC_API_KEY: 'key-a',
      OPENAI_API_KEY: 'key-o',
      CLAUDE_CODE_MODEL: 'sonnet',
      CODEX_MODEL: 'other',
      PORT: '4000',
    })._unsafeUnwrap();
    expect(config).toEqual({
      port: 4000,
      password: undefined,
      hosted: false,
      runtime: 'local',
      sandboxRunLimitMs: 240_000,
      recordedPaceMs: 60,
      claudeCode: { model: 'sonnet', apiKey: 'key-a' },
      codex: { model: 'other', apiKey: 'key-o' },
      taskCheck: { model: 'claude-haiku-5-5', apiKey: 'key-a' },
    });
  });

  it('treats an empty value as not set, as in a copied .env.example', () => {
    const config = readConfig({ ANTHROPIC_API_KEY: '', CODEX_MODEL: '  ', PORT: '' })._unsafeUnwrap();
    expect(config.claudeCode.apiKey).toBeUndefined();
    expect(config.codex.model).toBe('gpt-6-luna');
    expect(config.port).toBe(3001);
  });

  it('runs the agents in a sandbox on Vercel, and on this machine elsewhere', () => {
    const keys = { ANTHROPIC_API_KEY: 'key-a', OPENAI_API_KEY: 'key-o', DEMO_PASSWORD: 'a password' };
    expect(readConfig(keys)._unsafeUnwrap().runtime).toBe('local');
    expect(readConfig({ ...keys, VERCEL: '1' })._unsafeUnwrap().runtime).toBe('sandbox');
    expect(readConfig({ ...keys, VERCEL: '1', AGENT_RUNTIME: 'recorded' })._unsafeUnwrap().runtime).toBe(
      'recorded',
    );
  });

  it('refuses the sandbox without both keys, naming the missing one: a sandbox has no login', () => {
    const error = readConfig({ AGENT_RUNTIME: 'sandbox', ANTHROPIC_API_KEY: 'key-a' })._unsafeUnwrapErr();
    expect(error).toContain('OPENAI_API_KEY');
    expect(error).not.toContain('ANTHROPIC_API_KEY');
  });

  it('refuses to host an API with no password: its address is public and a call spends the keys', () => {
    const keys = { ANTHROPIC_API_KEY: 'key-a', OPENAI_API_KEY: 'key-o' };
    expect(readConfig({ ...keys, VERCEL: '1' })._unsafeUnwrapErr()).toContain('DEMO_PASSWORD');
    expect(readConfig({ ...keys, VERCEL: '1', DEMO_PASSWORD: 'short' })._unsafeUnwrapErr()).toContain(
      'DEMO_PASSWORD',
    );
    expect(readConfig({ ...keys, VERCEL: '1', DEMO_PASSWORD: 'a password' })._unsafeUnwrap()).toMatchObject({
      password: 'a password',
      hosted: true,
    });
  });

  it('names the variable that is wrong', () => {
    const error = readConfig({ PORT: 'eighty' })._unsafeUnwrapErr();
    expect(error).toContain('PORT');
    expect(error).toContain('.env');
  });
});
