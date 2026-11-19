import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { serve } from '@hono/node-server';

import { createApp } from './app.ts';
import { readConfig } from './config.ts';
import { createContainer } from './container.ts';

const envFile = join(import.meta.dirname, '../../../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const config = readConfig(process.env);
if (config.isErr()) {
  console.error(config.error);
  process.exit(1);
}

const { port } = config.value;
serve({ fetch: createApp(createContainer(config.value)).fetch, port }, () => {
  console.log(`API on http://localhost:${port}  (reference: http://localhost:${port}/docs)`);
});
