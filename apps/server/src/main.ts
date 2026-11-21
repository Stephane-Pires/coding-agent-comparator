import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { serve } from '@hono/node-server';

import { createApp } from './api.ts';
import { readConfig } from './config.ts';
import { createContainer } from './container.ts';
import { machineRuntime } from './runtimes/local.ts';

const envFile = join(import.meta.dirname, '../../../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const config = readConfig(process.env);
if (config.isErr()) {
  console.error(config.error);
  process.exit(1);
}

const { port, password, hosted } = config.value;
const app = createApp(createContainer(machineRuntime(config.value)), { password, https: hosted });
serve({ fetch: app.fetch, port }, () => {
  console.log(`API on http://localhost:${port}  (reference: http://localhost:${port}/docs)`);
});
