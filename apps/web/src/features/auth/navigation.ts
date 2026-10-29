/**
 * Where a signed-out user is sent, and where they come back to.
 *
 * `next` is a path on this site and nothing else. It is validated both when it
 * is written into a link and when it is read back from the query string, since
 * either side can be edited. Only the path and query travel in `next`; the
 * workbench capability in the URL fragment is carried separately, so it never
 * appears in a query string.
 */

const MAX_NEXT_LENGTH = 512;
const AUTH_PATHS = new Set(["/login", "/register"]);

/** Control characters and backslashes never belong in an in-site path. */
function hasControlOrBackslash(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f || code === 0x5c) return true;
  }
  return false;
}

/** Returns `next` if it is a safe in-site path, otherwise `/`. */
export function safeNextPath(value: string | null | undefined): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_NEXT_LENGTH) return "/";
  // Only a single leading slash is allowed: `//host` and `/\host` leave the site.
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (hasControlOrBackslash(value)) return "/";
  // A colon could start a scheme (`javascript:`), so it is refused everywhere.
  if (value.includes(":")) return "/";
  // The exported site ends every path in a slash, so `/login/` is the same page.
  const path = (value.split(/[?#]/, 1)[0] ?? "/").replace(/(?<=.)\/$/, "");
  if (AUTH_PATHS.has(path)) return "/";
  return value;
}

/** The current path and query, as a `next` value. The fragment is excluded on purpose. */
export function currentPath(): string {
  if (typeof location === "undefined") return "/";
  return safeNextPath(`${location.pathname}${location.search}`);
}

/** The `next` a sign-in page was opened with, validated; `null` when it was not given. */
export function nextFromLocation(): string | null {
  if (typeof location === "undefined") return null;
  return new URLSearchParams(location.search).get("next");
}

/** The fragment that carries a local workbench's capability; empty when there is none. */
export function readFragment(): string {
  if (typeof location === "undefined") return "";
  return location.hash;
}

/**
 * A link to the sign-in or registration page that returns to `next`. The
 * fragment is passed in, read after mount, so server and client render alike.
 * The trailing slash matches the exported route: a direct load of `/login?next=`
 * would otherwise be redirected by the static server, which drops the query.
 */
export function authHref(page: "/login" | "/register", next: string, fragment = ""): string {
  const query = new URLSearchParams({ next: safeNextPath(next) });
  return `${page}/?${query.toString()}${fragment}`;
}

/** Where to go after a successful sign-in: the validated `next`, with the fragment restored. */
export function afterSignInHref(next: string | null | undefined, fragment = ""): string {
  return `${safeNextPath(next)}${fragment}`;
}
