/**
 * The environment of a Claude Code process. Credentials come from the options only: a key or a setting left in
 * the server's own environment would silently take priority over the machine's login.
 */
export function environment(apiKey: string | undefined): Record<string, string | undefined> {
  const inherited = Object.entries(process.env).filter(([name]) => !/^(ANTHROPIC_|CLAUDE)/.test(name));
  return { ...Object.fromEntries(inherited), ...(apiKey === undefined ? {} : { ANTHROPIC_API_KEY: apiKey }) };
}
