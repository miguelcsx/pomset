/**
 * Refuses a write that does not come from the workbench's own origin.
 *
 * Session and capability tokens are never sent by the browser on its own, so
 * this is not what stops a forged request; it is a second check that a write
 * arrived through the page the workbench served. Reads are unaffected.
 */

import type { NextFunction, Request, Response } from "express";

import { type Exposure, isSameOrigin } from "./exposure.js";

export function sameOriginWrites(exposure: () => Exposure) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (
      !["GET", "HEAD"].includes(request.method) &&
      !isSameOrigin(exposure(), request.headers.host, request.headers.origin)
    ) {
      response.status(403).json({ error: "Same-origin requests are required", code: "forbidden" });
      return;
    }
    next();
  };
}
