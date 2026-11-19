import { OpenAPIGenerator } from '@orpc/openapi';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { implement } from '@orpc/server';
import { RPCHandler } from '@orpc/server/fetch';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { Scalar } from '@scalar/hono-api-reference';
import { Hono } from 'hono';

import type { CheckTask, StartRun } from '@comparator/application';
import { contract } from '@comparator/contracts';

import { present } from './presenter.ts';

export interface AppDeps {
  readonly startRun: StartRun;
  readonly checkTask: CheckTask;
}

/** A request that nobody can cancel still needs a signal. */
const NEVER_ABORTED = new AbortController().signal;

/**
 * Keeps a run's stream live through whatever stands between the API and the reader. A proxy that compresses a
 * response holds it back until it has enough to compress, which for a stream of events means until the end:
 * `no-transform` tells it to pass each event on as it is.
 */
function live(response: Response): Response {
  if (response.headers.get('content-type')?.startsWith('text/event-stream'))
    response.headers.set('cache-control', 'no-cache, no-transform');
  return response;
}

/**
 * The HTTP API. One contract, served twice: `/rpc` for the typed client of the web app, `/api` as plain REST.
 * `/openapi.json` is generated from the same contract, and `/docs` shows it.
 */
export function createApp({ startRun, checkTask }: AppDeps): Hono {
  const router = implement(contract).router({
    tasks: {
      check: implement(contract).tasks.check.handler(({ input, signal }) =>
        checkTask({ ...input, signal: signal ?? NEVER_ABORTED }),
      ),
    },
    runs: {
      start: implement(contract).runs.start.handler(({ input, signal }) =>
        present(startRun({ ...input, signal: signal ?? NEVER_ABORTED })),
      ),
    },
  });
  const rpc = new RPCHandler(router);
  const rest = new OpenAPIHandler(router);
  const openapi = new OpenAPIGenerator({ schemaConverters: [new ZodToJsonSchemaConverter()] });

  const app = new Hono();
  app.use('/rpc/*', async (c, next) => {
    const { matched, response } = await rpc.handle(c.req.raw, { prefix: '/rpc' });
    return matched ? live(response) : next();
  });
  app.use('/api/*', async (c, next) => {
    const { matched, response } = await rest.handle(c.req.raw, { prefix: '/api' });
    return matched ? live(response) : next();
  });
  app.get('/openapi.json', async (c) =>
    c.json(
      await openapi.generate(router, {
        info: {
          title: 'Coding Agent Comparator API',
          version: '0.0.0',
          description: 'Send one task to several coding agents and watch how each performs.',
        },
        servers: [{ url: '/api' }],
      }),
    ),
  );
  app.get('/docs', Scalar({ url: '/openapi.json', pageTitle: 'Coding Agent Comparator API' }));
  return app;
}
