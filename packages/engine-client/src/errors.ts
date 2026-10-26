/**
 * The single error vocabulary, as this package uses it.
 *
 * The codes and their synchronous HTTP mapping belong to the contracts; what is
 * added here is the shape a validation refusal takes, so a refusal carries the
 * offending JSON pointer alongside the record and nothing has to re-derive it
 * from a message string.
 */

import { HTTP_STATUS, type ErrorCode, type ErrorRecord } from "@pomset/contracts";

export { HTTP_STATUS };
export type { ErrorCode, ErrorRecord };

export interface Rejection {
  readonly record: ErrorRecord;
  /** RFC 6901 JSON pointer to the offending member. */
  readonly pointer: string;
}

export function errorRecord(
  code: ErrorCode,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): ErrorRecord {
  return details ? { code, message, details } : { code, message };
}

/** One rejected input, carrying the shared vocabulary and its pointer. */
export function inputInvalid(
  pointer: string,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): Rejection {
  return { record: errorRecord("INPUT_INVALID", message, details), pointer };
}

/** The synchronous HTTP status for a code, for the API surface. */
export function statusFor(code: ErrorCode): number {
  return HTTP_STATUS[code];
}
