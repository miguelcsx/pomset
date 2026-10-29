/**
 * Requires a signed-in account, and optionally a role, before a route runs.
 *
 * The account is loaded from the store for each request, so the role checked
 * here is the one the account has now. The signed-in account is kept in
 * `response.locals` for the handlers that follow.
 */

import type { NextFunction, Request, Response } from "express";

import type { Account, Role } from "../../domain/accounts/Account.js";
import { ApplicationError, forbidden, unauthenticated } from "../../domain/errors/ApplicationError.js";
import type { ResolveSession } from "../../application/accounts/ResolveSession.js";

const BEARER = /^Bearer (\S+)$/;

export function authenticate(resolveSession: ResolveSession) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    const match = BEARER.exec(request.headers.authorization ?? "");
    if (!match) {
      next(unauthenticated("Sign in to continue"));
      return;
    }
    try {
      response.locals["account"] = await resolveSession.execute(match[1]!);
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Loads the account when a valid token is presented, and otherwise continues
 * without one. For a read that is public but personal when signed in: a missing
 * or stale token must not turn the public description into an error.
 */
export function optionalAccount(resolveSession: ResolveSession) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    const match = BEARER.exec(request.headers.authorization ?? "");
    if (!match) {
      next();
      return;
    }
    try {
      response.locals["account"] = await resolveSession.execute(match[1]!);
      next();
    } catch (error) {
      if (error instanceof ApplicationError && error.kind === "unauthenticated") {
        next();
        return;
      }
      next(error);
    }
  };
}

export function requireRole(role: Role) {
  return (_request: Request, response: Response, next: NextFunction): void => {
    if (currentAccount(response).role !== role) {
      next(forbidden("This page is for administrators"));
      return;
    }
    next();
  };
}

export function currentAccount(response: Response): Account {
  return response.locals["account"] as Account;
}
