/**
 * Page requests for every list the API returns.
 *
 * Lists are bounded so one request cannot make the server read an unbounded
 * table. A malformed page number is refused rather than silently corrected,
 * because a client that asks for page `-1` has a bug it should hear about.
 */

import { badRequest } from "./errors/ApplicationError.js";

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;

export interface PageRequest {
  readonly page: number;
  readonly pageSize: number;
}

export interface PageInfo extends PageRequest {
  readonly total: number;
  readonly totalPages: number;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly pagination: PageInfo;
}

const WHOLE_NUMBER = /^[1-9]\d{0,5}$/;

export function parsePageRequest(query: Readonly<Record<string, unknown>>): PageRequest {
  const page = wholeNumber(query["page"], 1, "page");
  const pageSize = wholeNumber(query["pageSize"], DEFAULT_PAGE_SIZE, "pageSize");
  if (pageSize > MAX_PAGE_SIZE)
    throw badRequest(`Ask for at most ${MAX_PAGE_SIZE} items per page`, {
      fields: { pageSize: `Use at most ${MAX_PAGE_SIZE}` },
    });
  return { page, pageSize };
}

export function pageOf<T>(request: PageRequest, items: readonly T[], total: number): Page<T> {
  return {
    items,
    pagination: {
      ...request,
      total,
      totalPages: Math.ceil(total / request.pageSize),
    },
  };
}

/** The rows to skip and take for a page, for a store that paginates itself. */
export function window(request: PageRequest): { skip: number; take: number } {
  return { skip: (request.page - 1) * request.pageSize, take: request.pageSize };
}

function wholeNumber(value: unknown, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !WHOLE_NUMBER.test(value))
    throw badRequest(`${name} must be a positive whole number`, {
      fields: { [name]: "Use a whole number greater than zero" },
    });
  return Number(value);
}
