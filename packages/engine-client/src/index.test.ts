import { describe, expect, it } from "vitest";

import { PROTOCOL_VERSION } from "./index.js";

describe("@pomset/engine-client", () => {
  it("declares the initial engine protocol version", () => {
    expect(PROTOCOL_VERSION).toBe(1);
  });
});
