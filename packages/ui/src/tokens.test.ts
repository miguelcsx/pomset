import { describe, expect, it } from "vitest";

import { SPACING, STATUS_ROLES, STATUS_ROLE_LABELS } from "./tokens.js";

describe("workbench tokens", () => {
  it("uses the settled spacing scale", () => {
    expect(SPACING).toEqual([4, 8, 12, 16, 24, 32]);
  });

  it("carries exactly five status roles", () => {
    expect(STATUS_ROLES).toHaveLength(5);
  });

  it("labels every role, so status is never colour alone", () => {
    for (const role of STATUS_ROLES) {
      expect(STATUS_ROLE_LABELS[role]).toBeTruthy();
    }
  });
});
