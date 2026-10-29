/**
 * A list the API returns: `data` holds the items and `pagination` the page they
 * belong to. The client keeps the items as `items`, so callers read one name.
 * Anything else is refused at the boundary.
 */

import { arrayField, asObject, numberField, type JsonObject } from "./json";

export interface PageInfo {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly pagination: PageInfo;
}

export function parsePage<T>(value: unknown, parseItem: (item: unknown) => T): Page<T> {
  const record: JsonObject = asObject(value);
  const pagination = asObject(record["pagination"]);
  return {
    items: arrayField(record, "data").map(parseItem),
    pagination: {
      page: numberField(pagination, "page"),
      pageSize: numberField(pagination, "pageSize"),
      total: numberField(pagination, "total"),
      totalPages: numberField(pagination, "totalPages"),
    },
  };
}

const PAGE_PATTERN = /^[1-9]\d{0,5}$/;

/** A page number from a query string. Anything malformed reads as the first page. */
export function pageFromQuery(value: string | null): number {
  return value !== null && PAGE_PATTERN.test(value) ? Number(value) : 1;
}

export function pageQuery(page: number, pageSize: number): string {
  return new URLSearchParams({ page: String(page), pageSize: String(pageSize) }).toString();
}
