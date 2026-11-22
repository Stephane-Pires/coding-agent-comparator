import { setTimeout as wait } from 'node:timers/promises';

import { OpenAPIGenerator } from '@orpc/openapi';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { implement, ORPCError } from '@orpc/server';
import { RPCHandler } from '@orpc/server/fetch';
import {
  RequestHeadersPlugin,
  ResponseHeadersPlugin,
  type RequestHeadersPluginContext,
  type ResponseHeadersPluginContext,
} from '@orpc/server/plugins';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { Scalar } from '@scalar/hono-api-reference';
import { Hono } from 'hono';

import type { CheckTask, StartRun } from '@comparator/application';
import { contract } from '@comparator/contracts';

import { createAccess, type AccessOptions } from './access.ts';
import { present } from './presenter.ts';

export interface AppDeps {
  readonly startRun: StartRun;
  readonly checkTask: CheckTask;
}

/** What a procedure knows of its request: the headers it came with, and those of its answer. */
type Context = RequestHeadersPluginContext & ResponseHeadersPluginContext;

/**
 * How long a wrong password waits for its answer. It counts nothing, so it needs no store, and it turns guessing
 * into one try a second for each open connection: a long password is then out of reach.
 */
export const WRONG_PASSWORD_WAIT_MS = 1000;

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
 *
 * This file builds the API from what it is given. `main.ts` serves it on a machine; `index.ts` hands it to Vercel.
 */
export function createApp({ startRun, checkTask }: AppDeps, options: AccessOptions): Hono {
  const access = createAccess(options);
  const os = implement(contract).$context<Context>();
  // What can start work, and so spend the API keys, is for those who gave the password.
  const locked = os.middleware(async ({ context, next }) => {
    const headers = context.reqHeaders ?? new Headers();
    if (access.allows(headers)) return next();
    // A password sent with the call was wrong: it costs the same wait as on the form.
    if (headers.has('authorization')) await wait(WRONG_PASSWORD_WAIT_MS);
    throw new ORPCError('UNAUTHORIZED');
  });
  const router = os.router({
    access: {
      get: os.access.get.handler(({ context }) => ({
        allowed: access.allows(context.reqHeaders ?? new Headers()),
      })),
      enter: os.access.enter.handler(async ({ input, context }) => {
        const allowed = access.isPassword(input.password);
        if (!allowed) await wait(WRONG_PASSWORD_WAIT_MS);
        if (allowed && access.required) context.resHeaders?.set('set-cookie', access.passCookie());
        return { allowed };
      }),
    },
    tasks: {
      check: os.tasks.check
        .use(locked)
        .handler(({ input, signal }) => checkTask(input.task, signal ?? NEVER_ABORTED)),
    },
    runs: {
      start: os.runs.start
        .use(locked)
        .handler(({ input, signal }) => present(startRun(input.agent, input.task, signal ?? NEVER_ABORTED))),
    },
  });
  const plugins = [new RequestHeadersPlugin<Context>(), new ResponseHeadersPlugin<Context>()];
  const rpc = new RPCHandler(router, { plugins });
  const rest = new OpenAPIHandler(router, { plugins });
  const openapi = new OpenAPIGenerator({ schemaConverters: [new ZodToJsonSchemaConverter()] });

  const app = new Hono();
  app.use('/rpc/*', async (c, next) => {
    const { matched, response } = await rpc.handle(c.req.raw, { prefix: '/rpc', context: {} });
    return matched ? live(response) : next();
  });
  app.use('/api/*', async (c, next) => {
    const { matched, response } = await rest.handle(c.req.raw, { prefix: '/api', context: {} });
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
        // Gives the reference a field for the password, sent with each call made from it.
        ...(access.required
          ? {
              components: { securitySchemes: { password: { type: 'http' as const, scheme: 'bearer' } } },
              security: [{ password: [] }],
            }
          : {}),
      }),
    ),
  );
  app.get('/docs', Scalar({ url: '/openapi.json', pageTitle: 'Coding Agent Comparator API' }));
  return app;
}
