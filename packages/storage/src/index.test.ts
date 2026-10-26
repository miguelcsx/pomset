import { describe, expect, it } from "vitest";

import { RETENTION_CLASSES } from "./index.js";

describe("@pomset/storage", () => {
  it("declares exactly the four retention classes", () => {
    expect(RETENTION_CLASSES).toEqual([
      "job",
      "project",
      "publication",
      "permanent",
    ]);
  });
});
