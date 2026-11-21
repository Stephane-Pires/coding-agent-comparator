import { createHash, timingSafeEqual } from 'node:crypto';

import { parse } from 'hono/utils/cookie';

/** The cookie that says its browser gave the password. */
const PASS_COOKIE = 'comparator-pass';
const WEEK_SECONDS = 60 * 60 * 24 * 7;

export interface AccessOptions {
  /** The one password of the app. Not set: everyone is allowed, which is for a dev machine only. */
  readonly password: string | undefined;
  /** Whether the app is served over HTTPS, as a hosted one is: the cookie is then never sent in clear. */
  readonly https: boolean;
}

/** Who may use the API: the rules of the password, apart from HTTP routes. */
export interface Access {
  /** Whether a request with these headers may check tasks and start runs. */
  allows(headers: Headers): boolean;
  isPassword(given: string): boolean;
  /** The `Set-Cookie` value that gives a browser its pass. */
  passCookie(): string;
  /** Whether a password is asked at all. */
  readonly required: boolean;
}

const digest = (text: string) => createHash('sha256').update(text).digest();
/** Digests are compared, in constant time: how long it takes says nothing about the password. */
const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

export function createAccess({ password, https }: AccessOptions): Access {
  if (password === undefined)
    return { required: false, allows: () => true, isPassword: () => true, passCookie: () => '' };
  // The pass is a digest: the cookie does not carry the password, and changing the password ends every pass.
  const pass = digest(`${PASS_COOKIE}:${password}`).toString('hex');
  return {
    required: true,
    allows(headers) {
      // A browser sends its pass; a program may send the password itself with each call.
      const cookie = parse(headers.get('cookie') ?? '')[PASS_COOKIE];
      const bearer = /^Bearer (.+)$/.exec(headers.get('authorization') ?? '')?.[1];
      return (cookie !== undefined && same(cookie, pass)) || (bearer !== undefined && same(bearer, password));
    },
    isPassword: (given) => same(given, password),
    passCookie: () =>
      // HttpOnly: no script of the page can read it. Lax: another site cannot make a browser send it on a call.
      `${PASS_COOKIE}=${pass}; Path=/; Max-Age=${WEEK_SECONDS}; HttpOnly; SameSite=Lax${https ? '; Secure' : ''}`,
  };
}
