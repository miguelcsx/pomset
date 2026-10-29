/**
 * The one place where a failure becomes an HTTP status.
 *
 * Handlers call `next(error)`; none of them builds a status itself, and none of
 * them reads the text of a message to decide one. An unexpected failure is
 * logged in full and answered with a generic message, because a database or
 * filesystem error text describes the server's internals, not the caller's mistake.
 */

import type { NextFunction, Request, Response } from "express";

import {
  ApplicationError,
  type ErrorKind,
} from "../../domain/errors/ApplicationError.js";

const STATUS: Record<ErrorKind, number> = {
  bad_request: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  too_large: 413,
  too_many_requests: 429,
  unavailable: 503,
};

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void {
  if (error instanceof ApplicationError) {
    const fields = error.details?.["fields"];
    response.status(STATUS[error.kind]).json({
      error: error.message,
      code: error.kind,
      ...(fields ? { fields } : {}),
      ...(error.details && !fields ? { details: error.details } : {}),
    });
    return;
  }

  // `express.json` rejects a malformed or oversized body before any handler
  // runs, and tags the error with a `type` that names the cause.
  const type = (error as { type?: unknown } | null)?.type;
  if (type === "entity.too.large") {
    response.status(413).json({ error: "The request body exceeds the workbench limit", code: "too_large" });
    return;
  }
  if (type === "entity.parse.failed") {
    response.status(400).json({ error: "The request body is not valid JSON", code: "bad_request" });
    return;
  }

  console.error(error);
  response.status(500).json({
    error: "Something went wrong on the server. Try again shortly.",
    code: "internal",
  });
}
