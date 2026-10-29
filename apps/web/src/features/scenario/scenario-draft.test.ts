import { expect, it } from "vitest";

import { inferEntrypoint } from "./scenario-draft";

it("names the first top-level function of the entry source", () => {
  expect(inferEntrypoint("import math\n\ndef transform(x):\n    return x\n")).toBe("transform");
  expect(inferEntrypoint("def _kernel2(a):\n  pass\ndef other(b):\n  pass\n")).toBe("_kernel2");
});

it("names nothing when the source has no top-level function", () => {
  expect(inferEntrypoint("")).toBeUndefined();
  expect(inferEntrypoint(undefined)).toBeUndefined();
  expect(inferEntrypoint("    def nested(x):\n        pass\n")).toBeUndefined();
  expect(inferEntrypoint("def 9bad(x):\n    pass\n")).toBeUndefined();
});
