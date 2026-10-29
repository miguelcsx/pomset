/**
 * The local workbench's capability: the token printed in its URL, which the
 * browser sends in `X-Workbench-Token`.
 *
 * It is a second layer beneath the accounts, not a replacement for them. It is
 * applied only when a capability is configured, which is the local mode; the
 * public deployment has no capability because its URL carries no fragment, so
 * the accounts are the only credential there.
 *
 * It lives in its own header so that `Authorization: Bearer` stays free for the
 * session token, and the two layers never see each other's credential.
 */

import { timingSafeEqual } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

export const CAPABILITY_HEADER = "x-workbench-token";

export function capability(token: string) {
  const expected = Buffer.from(token);
  return (request: Request, response: Response, next: NextFunction): void => {
    const header = request.headers[CAPABILITY_HEADER];
    const supplied = Buffer.from(typeof header === "string" ? header : "");
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      response.status(401).json({
        error:
          "Open the workbench URL printed by its local server to authorize this browser.",
        code: "unauthenticated",
      });
      return;
    }
    next();
  };
}
