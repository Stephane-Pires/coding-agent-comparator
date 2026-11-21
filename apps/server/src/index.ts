// The entry Vercel looks for: a file named `src/index.ts` whose default export is the Hono app. On a machine of
// ours the entry is `main.ts`, which serves the same API on a port.
import { createApp } from './api.ts';
import { readConfig } from './config.ts';
import { createContainer } from './container.ts';
import { hostedRuntime } from './runtimes/hosted.ts';

const config = readConfig(process.env);
// A hosted API that is set up wrongly does not start: the reason is in its logs, and every call fails.
if (config.isErr()) throw new Error(config.error);
if (config.value.runtime !== 'sandbox')
  throw new Error(
    'Invalid configuration. A hosted API runs the agents in sandboxes only: unset AGENT_RUNTIME.',
  );

export default createApp(createContainer(hostedRuntime(config.value)), {
  password: config.value.password,
  https: config.value.hosted,
});
