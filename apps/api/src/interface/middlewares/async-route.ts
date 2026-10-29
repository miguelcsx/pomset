/**
 * Express 4 does not await a handler, so a rejected promise would leave the
 * request hanging. This forwards every rejection to the error handler instead.
 */

import type { NextFunction, Request, Response } from "express";

type Handler = (request: Request, response: Response) => Promise<void>;

export function asyncRoute(handler: Handler) {
  return (request: Request, response: Response, next: NextFunction): void => {
    handler(request, response).catch(next);
  };
}
