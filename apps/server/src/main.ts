import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { serve } from '@hono/node-server';

import { createAccess } from './access.ts';
import { createApp } from './api.ts';
import { describeConfigError, readConfig } from './config.ts';
import { createContainer } from './container.ts';
import { createMachineRuntime } from './runtimes/local.ts';

const envFile = join(import.meta.dirname, '../../../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const config = readConfig(process.env);
if (config.isErr()) {
  console.error(describeConfigError(config.error));
  process.exit(1);
}

const { port, password, isHosted } = config.value;
const app = createApp(createContainer(createMachineRuntime(config.value)), createAccess(password, isHosted));
serve({ fetch: app.fetch, port }, () => {
  console.log(`API on http://localhost:${port}  (reference: http://localhost:${port}/docs)`);
});
