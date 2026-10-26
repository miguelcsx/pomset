import { RETENTION_CLASSES } from "@pomset/storage";
import { describe, expect, it } from "vitest";

import * as cli from "./index.js";

describe("@pomset/cli", () => {
  it("loads as a module", () => {
    expect(cli).toBeTypeOf("object");
  });

  it("reaches the workspace packages its dependency direction permits", () => {
    expect(RETENTION_CLASSES).toContain("publication");
  });
});
