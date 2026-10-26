/**
 * The loopback trust boundary.
 *
 * ADR-0013 makes the workbench a single-owner loopback application. Only the
 * host it actually bound and a same-origin browse are served, and every
 * response carries headers that keep it out of frames, caches and cross-origin
 * reads.
 */

import type { NextFunction, Request, Response } from "express";

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin",
} as const;

/**
 * `boundPort` is read per request: an ephemeral bind (port 0) only learns its
 * port after `listen`, and the check must compare against the port that is
 * actually serving.
 */
export function security(boundPort: () => number) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const host = request.headers.host;
    const origin = request.headers.origin;
    const expected = [`127.0.0.1:${boundPort()}`, `localhost:${boundPort()}`];
    if (!expected.includes(host ?? "") || (origin && origin !== `http://${host}`)) {
      response.status(403).json({ error: "Forbidden host or origin" });
      return;
    }
    response.set(HEADERS);
    next();
  };
}
