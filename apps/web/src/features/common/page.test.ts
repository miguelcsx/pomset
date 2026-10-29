import { describe, expect, it } from "vitest";

import { pageFromQuery, pageQuery, parsePage } from "./page";

const envelope = {
  data: [{ id: "a" }, { id: "b" }],
  pagination: { page: 2, pageSize: 2, total: 5, totalPages: 3 },
};

const readId = (value: unknown) => (value as { id: string }).id;

describe("parsePage", () => {
  it("reads the items from data and the position from pagination", () => {
    const page = parsePage(envelope, readId);
    expect(page.items).toEqual(["a", "b"]);
    expect(page.pagination).toEqual({ page: 2, pageSize: 2, total: 5, totalPages: 3 });
  });

  it("refuses the bare array the API no longer sends", () => {
    expect(() => parsePage([{ id: "a" }], readId)).toThrow();
  });

  it("refuses an envelope whose pagination is missing", () => {
    expect(() => parsePage({ data: [] }, readId)).toThrow();
  });
});

describe("pageFromQuery", () => {
  it("reads a positive page number", () => {
    expect(pageFromQuery("3")).toBe(3);
  });

  it("reads anything missing or malformed as the first page", () => {
    expect(pageFromQuery(null)).toBe(1);
    expect(pageFromQuery("")).toBe(1);
    expect(pageFromQuery("0")).toBe(1);
    expect(pageFromQuery("-2")).toBe(1);
    expect(pageFromQuery("2.5")).toBe(1);
    expect(pageFromQuery("abc")).toBe(1);
    expect(pageFromQuery("1234567")).toBe(1);
  });
});

describe("pageQuery", () => {
  it("writes the page and page size", () => {
    expect(pageQuery(4, 10)).toBe("page=4&pageSize=10");
  });
});
