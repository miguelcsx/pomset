/**
 * The failures a use case is allowed to report.
 *
 * A category is named here and turned into an HTTP status in exactly one place,
 * `interface/middlewares/error-handler.middleware.ts`. No layer above infers a
 * status from the text of a message, which is what the previous
 * `message.startsWith("PROFILE_NOT_FOUND")` mapping did.
 */

export type ErrorKind =
  | "bad_request"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "too_large"
  | "too_many_requests"
  | "unavailable";

export class ApplicationError extends Error {
  constructor(
    readonly kind: ErrorKind,
    message: string,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export const badRequest = (
  message: string,
  details?: Readonly<Record<string, unknown>>,
): ApplicationError => new ApplicationError("bad_request", message, details);

export const unauthenticated = (message: string): ApplicationError =>
  new ApplicationError("unauthenticated", message);

export const forbidden = (message: string): ApplicationError =>
  new ApplicationError("forbidden", message);

export const tooManyRequests = (message: string): ApplicationError =>
  new ApplicationError("too_many_requests", message);

export const notFound = (
  message: string,
  details?: Readonly<Record<string, unknown>>,
): ApplicationError => new ApplicationError("not_found", message, details);

export const conflict = (
  message: string,
  details?: Readonly<Record<string, unknown>>,
): ApplicationError => new ApplicationError("conflict", message, details);

export const tooLarge = (message: string): ApplicationError =>
  new ApplicationError("too_large", message);

export const unavailable = (message: string): ApplicationError =>
  new ApplicationError("unavailable", message);
