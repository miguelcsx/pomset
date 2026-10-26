import { describe, expect, it } from "vitest";

import { ERROR_CODES, HTTP_STATUS, SchemaVersion } from "./index.js";

describe("@pomset/contracts", () => {
  it("carries the initial portable format version", () => {
    expect(SchemaVersion).toBe(1);
  });

  it("exposes exactly the eight error codes with one vocabulary", () => {
    expect(ERROR_CODES).toHaveLength(8);
    expect(Object.keys(HTTP_STATUS).sort()).toEqual([...ERROR_CODES].sort());
  });
});
