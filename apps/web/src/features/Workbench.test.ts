import { STATUS_ROLES } from "@pomset/ui";
import { describe, expect, it } from "vitest";

import { Workbench } from "./Workbench";

describe("Workbench shell", () => {
  it("is a component", () => {
    expect(typeof Workbench).toBe("function");
  });

  it("decorates with the five shared status roles", () => {
    expect(STATUS_ROLES).toHaveLength(5);
  });
});
