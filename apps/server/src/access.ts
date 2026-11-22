import { createHash, timingSafeEqual } from 'node:crypto';

import { parse } from 'hono/utils/cookie';

/** Who may use the API: the rules of the password, apart from HTTP routes. */
export interface Access {
  /** Whether a password is asked at all. */
  readonly isRequired: boolean;
  /** Whether a request with these headers may check tasks and start runs. */
  isAllowed(headers: Headers): boolean;
  isPassword(given: string): boolean;
  /** The `Set-Cookie` value that gives a browser its pass. */
  getPassCookie(): string;
}

/** The cookie that says its browser gave the password. */
const PASS_COOKIE = 'comparator-pass';

/** A pass lasts a week: a reviewer coming back to the app does not type the password again. */
const PASS_LIFETIME_SECONDS = 60 * 60 * 24 * 7;

const getDigest = (text: string) => createHash('sha256').update(text).digest();

/** Digests are compared, in constant time: how long it takes says nothing about the password. */
const isSame = (a: string, b: string) => timingSafeEqual(getDigest(a), getDigest(b));

/**
 * The rules of the password. Without `password`, everyone is allowed, which is for a dev machine only. With
 * `isHttps`, as on a hosted app, the cookie is never sent in clear.
 */
export function createAccess(password: string | undefined, isHttps: boolean): Access {
  if (password === undefined)
    return { isRequired: false, isAllowed: () => true, isPassword: () => true, getPassCookie: () => '' };
  // The pass is a digest: the cookie does not carry the password, and changing the password ends every pass.
  const pass = getDigest(`${PASS_COOKIE}:${password}`).toString('hex');
  return {
    isRequired: true,
    isAllowed(headers) {
      // A browser sends its pass; a program may send the password itself with each call.
      const cookie = parse(headers.get('cookie') ?? '')[PASS_COOKIE];
      const bearer = /^Bearer (.+)$/.exec(headers.get('authorization') ?? '')?.[1];
      return (
        (cookie !== undefined && isSame(cookie, pass)) || (bearer !== undefined && isSame(bearer, password))
      );
    },
    isPassword: (given) => isSame(given, password),
    getPassCookie: () =>
      // HttpOnly: no script of the page can read it. Lax: another site cannot make a browser send it on a call.
      `${PASS_COOKIE}=${pass}; Path=/; Max-Age=${PASS_LIFETIME_SECONDS}; HttpOnly; SameSite=Lax${isHttps ? '; Secure' : ''}`,
  };
}
