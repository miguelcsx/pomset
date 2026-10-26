/**
 * The capability the browser was handed when the workbench printed its URL.
 *
 * A content hash is never an access credential, so the bearer token is compared
 * in constant time and writes additionally require the same origin.
 */

import { timingSafeEqual } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

export function capability(token: string) {
  const expected = Buffer.from(token);
  return (request: Request, response: Response, next: NextFunction): void => {
    const supplied = Buffer.from(
      request.headers.authorization?.replace(/^Bearer /, "") ?? "",
    );
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      response.status(401).json({
        error:
          "Open the workbench URL printed by its local server to authorize this browser.",
      });
      return;
    }
    if (
      !["GET", "HEAD"].includes(request.method) &&
      request.headers.origin !== `http://${request.headers.host}`
    ) {
      response.status(403).json({ error: "Same-origin analysis requests are required" });
      return;
    }
    next();
  };
}
