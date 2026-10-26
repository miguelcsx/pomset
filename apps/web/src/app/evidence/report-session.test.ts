import { describe, expect, it } from "vitest";
import type { InspectionDocument } from "@pomset/ui";
import { rememberReport } from "./report-session.js";

function report(id: string, scenarioId = "scn_same"): InspectionDocument {
  return { analysis: { resultId: id }, scenario: { scenarioId } } as InspectionDocument;
}
describe("exact report session identities", () => {
  it("retains historical scenarios and never conflates them by name or backend", () => {
    const old = report("res_old", "scn_old"), next = report("res_new", "scn_new");
    expect(rememberReport([old], next)).toEqual([old, next]);
  });
  it("reopens the same report without duplicating a lane", () => {
    const same = report("res_same");
    expect(rememberReport([same], same)).toEqual([same]);
  });
  it("enforces four lanes per exact scenario without deleting existing evidence", () => {
    const lanes = Array.from({ length: 4 }, (_, i) => report(`res_${i}`));
    expect(() => rememberReport(lanes, report("res_fifth"))).toThrow("four lanes");
    expect(lanes).toHaveLength(4);
    expect(rememberReport(lanes, report("res_other", "scn_other"))).toHaveLength(5);
  });
});
