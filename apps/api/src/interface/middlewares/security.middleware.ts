/**
 * The trust boundary at the socket.
 *
 * ADR-0013 makes the local workbench a single-owner loopback application. ADR-0017
 * adds a public deployment that answers one hostname over HTTPS. In both, the
 * exported client is served from the same origin as the API, so the only Host
 * that arrives is the one that was bound. `next dev` is the exception: it runs on
 * its own port and proxies to us, and that is switched on explicitly rather than
 * assumed. Even then the request must still present a loopback Host, which is
 * what keeps a name that merely resolves to 127.0.0.1 from being accepted.
 */

import type { NextFunction, Request, Response } from "express";

import { type Exposure, isSameOrigin } from "./exposure.js";

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin",
} as const;

const LOOPBACK = /^(?:127\.0\.0\.1|localhost):\d+$/;

/** Origins the development client is allowed to arrive from. Empty by default. */
function developmentOrigins(): readonly string[] {
  return (process.env["POMSET_WORKBENCH_DEV_ORIGIN"] ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * `exposure` is read per request: an ephemeral bind (port 0) only learns its
 * port after `listen`, and the check must compare against the port that is
 * actually serving.
 */
export function security(exposure: () => Exposure) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const host = request.headers.host;
    const origin = request.headers.origin;

    const current = exposure();
    const sameOrigin = origin
      ? isSameOrigin(current, host, origin)
      : current.some((endpoint) => endpoint.host === host);
    const fromDevelopment =
      LOOPBACK.test(host ?? "") && developmentOrigins().includes(origin ?? "");

    if (!sameOrigin && !fromDevelopment) {
      response.status(403).json({ error: "Forbidden host or origin" });
      return;
    }

    response.set(HEADERS);
    next();
  };
}
