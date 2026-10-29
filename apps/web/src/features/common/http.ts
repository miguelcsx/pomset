/**
 * The one place the browser calls the API.
 *
 * Two credentials travel on different headers so neither layer sees the other:
 * `X-Workbench-Token` carries the local workbench's capability from the URL
 * fragment, and `Authorization: Bearer` carries the signed-in account's token.
 * Neither is ever placed in a URL, and no error message includes either.
 *
 * A 401 on a request that carried the account token means the session is no
 * longer valid, so the stored session is dropped and the route guards send the
 * user to sign in again.
 */

import { clearSession, currentToken } from "../auth/session-store";
import { fieldErrors, UnexpectedResponse } from "./json";

export const CAPABILITY_HEADER = "X-Workbench-Token";

export class ApiError extends Error {
  readonly status: number;
  readonly fields: Readonly<Record<string, string>>;

  constructor(message: string, status: number, fields: Readonly<Record<string, string>> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
  }
}

/** `none`: public call. `optional`: sent with the account token when there is one. `required`: refused locally without one. */
export type AuthMode = "none" | "optional" | "required";

export interface ApiRequestOptions {
  readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly body?: unknown;
  readonly auth?: AuthMode;
  readonly signal?: AbortSignal;
}

/**
 * The local workbench's capability, from `#workbench=<token>`. Hosted pages
 * have no fragment and return null. The fragment is never sent to a server.
 */
export function workbenchCapability(): string | null {
  const hash = typeof location === "undefined" ? "" : location.hash;
  return new URLSearchParams(hash.slice(1)).get("workbench");
}

/**
 * Every successful response carries its payload under `data`, and a failure
 * carries `error` instead, so a caller never has to guess which it received.
 */
export function unwrap(value: unknown): unknown {
  if (!value || typeof value !== "object" || !("data" in value))
    throw new Error("Invalid response envelope");
  return (value as { data: unknown }).data;
}

/**
 * Sends one request and returns the parsed envelope. Use `unwrap` for a single
 * record, or read `data` and `pagination` directly for a list.
 */
export async function apiRequest(path: string, options: ApiRequestOptions = {}): Promise<unknown> {
  const auth = options.auth ?? "none";
  const token = auth === "none" ? null : currentToken();
  if (auth === "required" && token === null)
    throw new ApiError("Sign in to continue.", 401);

  const headers: Record<string, string> = {};
  const capability = workbenchCapability();
  if (capability !== null) headers[CAPABILITY_HEADER] = capability;
  if (token !== null) headers["Authorization"] = `Bearer ${token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const init: RequestInit = {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    ...(options.signal ? { signal: options.signal } : {}),
  };

  let response: Response;
  try {
    response = await fetch(path, init);
  } catch (failure) {
    if (failure instanceof DOMException && failure.name === "AbortError") throw failure;
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
  }

  const parsed = await readJson(response);
  if (!response.ok) {
    if (response.status === 401 && token !== null) clearSession();
    throw errorFrom(response.status, parsed);
  }
  // An empty success (a 204 delete) is `undefined`; callers that need a body unwrap it.
  return parsed;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function errorFrom(status: number, body: unknown): ApiError {
  const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const message = typeof record["error"] === "string" ? record["error"] : `Request failed (${status}).`;
  return new ApiError(message, status, fieldErrors(record["fields"]));
}

const FALLBACK_MESSAGE = "Something went wrong. Try again.";

/**
 * The text a user may read for a failure. Only messages written for people
 * are passed on; anything else (a bug, a network detail) becomes the generic line.
 */
export function failureMessage(failure: unknown): string {
  if (failure instanceof ApiError || failure instanceof UnexpectedResponse) return failure.message;
  return FALLBACK_MESSAGE;
}
