import { describe, expect, it } from 'vite-plus/test';

import { readConfig } from './config.ts';

describe('readConfig', () => {
  it('needs nothing: no key means the agents use the login on the machine', () => {
    expect(readConfig({})._unsafeUnwrap()).toEqual({
      port: 3001,
      claudeCode: { model: 'haiku', apiKey: undefined },
      codex: { model: 'gpt-6-luna', apiKey: undefined },
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
      claudeCode: { model: 'sonnet', apiKey: 'key-a' },
      codex: { model: 'other', apiKey: 'key-o' },
    });
  });

  it('treats an empty value as not set, as in a copied .env.example', () => {
    const config = readConfig({ ANTHROPIC_API_KEY: '', CODEX_MODEL: '  ', PORT: '' })._unsafeUnwrap();
    expect(config.claudeCode.apiKey).toBeUndefined();
    expect(config.codex.model).toBe('gpt-6-luna');
    expect(config.port).toBe(3001);
  });

  it('names the variable that is wrong', () => {
    const error = readConfig({ PORT: 'eighty' })._unsafeUnwrapErr();
    expect(error).toContain('PORT');
    expect(error).toContain('.env');
  });
});
