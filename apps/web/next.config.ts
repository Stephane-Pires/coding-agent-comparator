import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { NextConfig } from 'next';

// One `.env` file for the whole repository, at its root: the same one the API reads.
const envFile = join(import.meta.dirname, '../../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

/** Where the API runs. A server-side setting: the browser never learns it. An empty value means "not set". */
const API_URL = process.env['API_URL']?.trim() || 'http://localhost:3001';

const config: NextConfig = {
  // Next.js would write an AGENTS.md of its own into this folder.
  agentRules: false,
  // The workspace packages are consumed as TypeScript source.
  transpilePackages: ['@comparator/ui', '@comparator/contracts', '@comparator/domain'],
  // The browser calls its own origin; the app forwards the API's typed route. No cross-origin rule is needed.
  rewrites: () => Promise.resolve([{ source: '/rpc/:path*', destination: `${API_URL}/rpc/:path*` }]),
};

export default config;
