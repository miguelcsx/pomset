/**
 * A list the API returns: `data` holds the items and the page they belong to.
 * The shape mirrors the API's `Page<T>`; anything else is refused at the boundary.
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
    items: arrayField(record, "items").map(parseItem),
    pagination: {
      page: numberField(pagination, "page"),
      pageSize: numberField(pagination, "pageSize"),
      total: numberField(pagination, "total"),
      totalPages: numberField(pagination, "totalPages"),
    },
  };
}

export function pageQuery(page: number, pageSize: number): string {
  return new URLSearchParams({ page: String(page), pageSize: String(pageSize) }).toString();
}
