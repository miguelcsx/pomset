import { expect, it } from "vitest";
import { closeTabs, openTab } from "./tab-state";
it("closes the active tab and chooses an adjacent editor without deleting source", () => {
  const paths = ["a.py", "b.py", "c.py"];
  const next = closeTabs({ closed: [], recent: [] }, paths, "b.py", "b.py", "one");
  expect(next.active).toBe("c.py"); expect(next.state.closed).toEqual(["b.py"]); expect(paths).toHaveLength(3);
  expect(openTab(next.state, "b.py")).toEqual({ closed: [], recent: [] });
});
it("supports closing others and all, including an empty editor", () => {
  const state = { closed: [], recent: [] };
  expect(closeTabs(state, ["a", "b"], "a", "b", "others")).toEqual({ state: { closed: ["a"], recent: ["a"] }, active: "b" });
  expect(closeTabs(state, ["a"], "a", "a", "all")).toEqual({ state: { closed: ["a"], recent: ["a"] } });
});
it("keeps the active editor when another tab closes and drops obsolete paths", () => {
  const next = closeTabs({ closed: ["removed"], recent: ["removed"] }, ["a", "b"], "a", "b", "one");
  expect(next.active).toBe("a"); expect(next.state).toEqual({ closed: ["b"], recent: ["b"] });
});
