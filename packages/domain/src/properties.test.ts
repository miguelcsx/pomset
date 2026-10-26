import { describe, expect, it } from "vitest";

import { PROPERTY_IDS, isAdmissibleProperty, isExtensionProperty } from "./properties.js";

describe("the property vocabulary", () => {
  it("names ten known properties", () => {
    expect(PROPERTY_IDS).toHaveLength(10);
  });

  it("admits a known property", () => {
    expect(isAdmissibleProperty("outputCoverage")).toBe(true);
  });

  it("admits a well-formed project-local extension", () => {
    expect(isAdmissibleProperty("x-numerical-drift")).toBe(true);
    expect(isExtensionProperty("x-numerical-drift")).toBe(true);
  });

  it("refuses an unknown property without the reserved prefix", () => {
    expect(isAdmissibleProperty("numericalDrift")).toBe(false);
    expect(isAdmissibleProperty("x-A")).toBe(false);
  });
});
