/**
 * Slows repeated attempts at sign-in and registration.
 *
 * Each rule counts one key per request: the caller's address, or the email the
 * request names. A key that exhausts its allowance is refused with 429 before
 * the password is checked, so a guessing run gains nothing from the check itself.
 */

import type { NextFunction, Request, Response } from "express";

import { tooManyRequests } from "../../domain/errors/ApplicationError.js";
import type { FixedWindowLimiter } from "../../infrastructure/limits/FixedWindowLimiter.js";

export interface LimitRule {
  readonly limiter: FixedWindowLimiter;
  /** The key to count for this request, or `undefined` to count nothing. */
  readonly keyOf: (request: Request) => string | undefined;
}

export function limitAttempts(...rules: LimitRule[]) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    for (const rule of rules) {
      const key = rule.keyOf(request);
      if (key !== undefined && !rule.limiter.allow(key)) {
        next(tooManyRequests("Too many attempts. Wait a few minutes and try again."));
        return;
      }
    }
    next();
  };
}

/** The caller's address, which Render's proxy supplies once `trust proxy` is set. */
export const byAddress = (request: Request): string => `ip:${request.ip ?? "unknown"}`;

/** The email a request names, normalized the way an account stores it. */
export const byEmail = (request: Request): string | undefined => {
  const email = (request.body as { email?: unknown } | undefined)?.email;
  return typeof email === "string" && email.trim() !== "" ? `email:${email.trim().toLowerCase()}` : undefined;
};
