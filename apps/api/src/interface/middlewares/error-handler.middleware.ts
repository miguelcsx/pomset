/**
 * The one place where a failure becomes an HTTP status.
 *
 * Handlers call `next(error)`; none of them builds a status itself, and none of
 * them reads the text of a message to decide one.
 */

import type { NextFunction, Request, Response } from "express";

import {
  ApplicationError,
  type ErrorKind,
} from "../../domain/errors/ApplicationError.js";

const STATUS: Record<ErrorKind, number> = {
  bad_request: 400,
  not_found: 404,
  conflict: 409,
  too_large: 413,
  unavailable: 503,
};

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void {
  if (error instanceof ApplicationError) {
    response.status(STATUS[error.kind]).json({
      error: error.message,
      code: error.kind,
      ...(error.details ? { details: error.details } : {}),
    });
    return;
  }

  // `express.json` rejects a malformed or oversized body before any handler
  // runs, and reports it through the body-parser error shape.
  const status = error instanceof SyntaxError ? 400 : (error as { status?: number }).status;
  if (status === 413) {
    response.status(413).json({ error: "The request body exceeds the workbench limit" });
    return;
  }
  if (status === 400) {
    response.status(400).json({ error: "The request body is not valid JSON" });
    return;
  }
  response
    .status(500)
    .json({ error: error instanceof Error ? error.message : String(error) });
}
