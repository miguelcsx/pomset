import { RETENTION_CLASSES } from "@pomset/storage";
import { describe, expect, it } from "vitest";

import * as api from "./index.js";

describe("@pomset/api", () => {
  it("loads as a module", () => {
    expect(api).toBeTypeOf("object");
  });

  it("reaches the worker it delegates execution to", async () => {
    const worker = await import("@pomset/worker");
    expect(worker).toBeTypeOf("object");
    expect(RETENTION_CLASSES).toContain("job");
  });
});
