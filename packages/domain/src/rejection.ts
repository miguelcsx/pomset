/**
 * The shape every rejection takes.
 *
 * `docs/delivery/02-foundation.md` requires that an invalid scenario produces a
 * machine-readable rejection list rather than a prose error, each entry carrying
 * the single error vocabulary and the JSON pointer of the offending value. A
 * validation function therefore returns either the value or the list, and never
 * a partially repaired value: nothing is dropped, defaulted or rewritten.
 */

import type { ErrorCode, ErrorRecord } from "@pomset/contracts";

export interface Rejection {
  readonly record: ErrorRecord;
  /** RFC 6901 JSON pointer to the offending member. */
  readonly pointer: string;
}

export type Validated<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly rejections: readonly Rejection[] };

export function accepted<T>(value: T): Validated<T> {
  return { ok: true, value };
}

export function rejected<T>(...rejections: readonly Rejection[]): Validated<T> {
  return { ok: false, rejections };
}

/** Builds one rejection with the shared error vocabulary. */
export function reject(
  code: ErrorCode,
  pointer: string,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): Rejection {
  const record: ErrorRecord = details ? { code, message, details } : { code, message };
  return { record, pointer };
}

/** `INPUT_INVALID`, the code every rejected input carries. */
export function inputInvalid(
  pointer: string,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): Rejection {
  return reject("INPUT_INVALID", pointer, message, details);
}

/** Escapes one JSON pointer segment per RFC 6901. */
export function pointer(...segments: readonly string[]): string {
  if (segments.length === 0) return "";
  return `/${segments.map((s) => s.replace(/~/g, "~0").replace(/\//g, "~1")).join("/")}`;
}
