import { expect, it } from "vitest";
import { inputIdentity } from "./input-identity.js";
import { newScenario } from "../scenario/scenario-draft.js";
it("ignores capture identity but tracks semantic scenario, file, budget and profile changes", () => {
  const scenario = newScenario("kernel.py");
  const copy = { id: "draft", files: [{ path: "kernel.py", source: "original" }] };
  const key = inputIdentity(copy, scenario, "profile", 10);
  expect(inputIdentity({ ...copy, id: "fork" }, { ...scenario, scenarioId: "captured", snapshotId: "snapshot", createdAt: "later", domain: { ...scenario.domain, domainId: "captured-domain" } }, "profile", 10)).toBe(key);
  expect(inputIdentity(copy, { ...scenario, entrypoint: { ...scenario.entrypoint, symbol: "other" } }, "profile", 10)).not.toBe(key);
  expect(inputIdentity(copy, scenario, "other", 10)).not.toBe(key);
  expect(inputIdentity(copy, scenario, "profile", 11)).not.toBe(key);
  expect(inputIdentity({ ...copy, files: [] }, scenario, "profile", 10)).not.toBe(key);
});
