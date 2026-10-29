import { expect, it } from "vitest";

import { inferEntrypoint, newScenario, parseScenario, scriptTitle, usableScenario } from "./scenario-draft";

it("titles a script after the entry point while the scenario is still untitled", () => {
  const draft = { ...newScenario("kernel.py"), entrypoint: { path: "kernel.py", symbol: "transform" } };
  expect(scriptTitle(draft)).toBe("kernel.py · transform");
  expect(scriptTitle({ ...draft, name: "Floor grid" })).toBe("Floor grid");
  expect(scriptTitle({ ...draft, entrypoint: { path: "kernel.py", symbol: "" } })).toBe("kernel.py");
});

it("starts a new scenario that the canonical contract accepts once the entry point is named", () => {
  const draft = newScenario("kernel.py");
  expect(draft.allocations).toHaveLength(1);
  expect(draft.domain.constraints).toHaveLength(1);
  expect(() => parseScenario(JSON.stringify({ ...draft, entrypoint: { path: "kernel.py", symbol: "transform" } }))).not.toThrow();
});

it("keeps a scenario the analysis can run and refuses one saved before the defaults existed", () => {
  const draft = newScenario("kernel.py");
  expect(usableScenario(draft)).toEqual(draft);
  // A draft from before the defaults has no allocation or no constraint; it must not be restored as it is.
  expect(usableScenario({ ...draft, allocations: [] })).toBeUndefined();
  expect(usableScenario({ ...draft, domain: { ...draft.domain, constraints: [] } })).toBeUndefined();
  expect(usableScenario(undefined)).toBeUndefined();
});

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
