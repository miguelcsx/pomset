import { SchemaVersion } from "@pomset/contracts";
import { describe, expect, it } from "vitest";

import * as domain from "./index.js";

describe("@pomset/domain", () => {
  it("exposes the policy surface", () => {
    expect(domain.validateScenario).toBeTypeOf("function");
    expect(domain.createWorkloadDomain).toBeTypeOf("function");
    expect(domain.createEligibilityPolicy).toBeTypeOf("function");
  });

  it("reaches the one contract package it is allowed to depend on", () => {
    expect(SchemaVersion).toBe(1);
  });
});
