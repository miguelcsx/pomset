import { expect, it } from "vitest";
import type { Coverage } from "@pomset/contracts";
import { domainRows } from "./domain-rows.js";
const region = (id: string, propertyId: string, classification: "established" | "unknown", constraints = ["N > 0"]): Coverage["regions"][number] => ({ regionId: id, constraints, classifications: [{ propertyId, classification, method: "symbolic" }] });
it("co-locates classifications for the same recorded constraint set", () => {
  const input = [region("r1", "bounds", "established"), region("r2", "coverage", "unknown")];
  const rows = domainRows(input);
  expect(rows).toHaveLength(1); expect(rows[0]?.classifications).toHaveLength(2); expect(input[0]?.classifications).toHaveLength(1);
});
it("does not merge conflicting classifications or different constraint sets", () => {
  expect(domainRows([region("r1", "bounds", "established"), region("r2", "bounds", "unknown"), region("r3", "bounds", "established", ["N > 1"])])).toHaveLength(3);
});
