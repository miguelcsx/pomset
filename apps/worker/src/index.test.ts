import { PROTOCOL_VERSION } from "@pomset/engine-client";
import { describe, expect, it } from "vitest";

import * as worker from "./index.js";

describe("@pomset/worker", () => {
  it("loads as a module", () => {
    expect(worker).toBeTypeOf("object");
  });

  it("reaches the engine boundary, which it spawns", () => {
    expect(PROTOCOL_VERSION).toBe(1);
  });
});
