/** Contextual integrity checks; call after canonical shape validation. */
import type { AnalysisResult, Scenario, IntExpr } from "./generated/index.js";
import { isAllowedTuple } from "./tuples.js";

export function evidenceLinkProblems(result: AnalysisResult, scenario?: Scenario): string[] {
  const problems: string[] = [];
  const unique = (values: readonly string[], label: string): Set<string> => {
    const set = new Set(values);
    if (set.size !== values.length) problems.push(`${label}: duplicate identities`);
    return set;
  };
  const actors = unique((result.actors ?? []).map((item) => item.actorId), "actors");
  const events = unique((result.events ?? []).map((item) => item.eventId), "events");
  const witnesses = unique((result.witnesses ?? []).map((item) => item.witnessId), "witnesses");
  const findings = unique((result.findings ?? []).map((item) => item.findingId), "findings");
  unique(result.propertyResults.map((item) => item.propertyResultId), "propertyResults");
  const refs = (ids: readonly string[], set: Set<string>, label: string) => {
    for (const id of ids) if (!set.has(id)) problems.push(`${label}: missing ${id}`);
  };
  for (const item of result.events ?? []) refs([item.actorId], actors, "event actor");
  for (const item of [...(result.findings ?? []), ...(result.witnesses ?? [])]) {
    refs(item.actorIds, actors, "actors");
    refs(item.eventIds, events, "events");
  }
  for (const finding of result.findings ?? []) {
    if (finding.witnessId) refs([finding.witnessId], witnesses, "witness");
  }
  for (const property of result.propertyResults) {
    if (!isAllowedTuple(property.outcome, property.method, property.evidenceClass)) problems.push("prohibited evidence tuple");
    refs(property.findingIds ?? [], findings, "property findings");
    refs(property.witnessIds ?? [], witnesses, "property witnesses");
    if (property.assumptions.domainRef !== result.domain.domainId) problems.push("property domain mismatch");
    if (property.coverageRef !== result.coverage.coverageId) problems.push("property coverage mismatch");
  }
  if (!scenario) return problems;
  if (result.scenarioId !== scenario.scenarioId || result.snapshotId !== scenario.snapshotId || result.domain.domainId !== scenario.domain.domainId) problems.push("scenario provenance mismatch");
  const required = new Set<string>();
  const parameters = (expr: IntExpr) => {
    if (expr.op === "parameter" && expr.parameter) required.add(expr.parameter);
    for (const operand of expr.operands ?? []) parameters(operand);
  };
  for (const expr of [...scenario.launch.grid, ...(scenario.launch.block ?? []), ...scenario.allocations.flatMap((item) => [...item.shape, ...(item.strides ?? [])])]) parameters(expr);
  for (const constraint of scenario.domain.constraints ?? []) { parameters(constraint.lhs); parameters(constraint.rhs); }
  for (const witness of result.witnesses ?? []) {
    const assigned = unique(witness.assignments.map((item) => item.name), "witness assignments");
    for (const name of required) if (!assigned.has(name)) problems.push(`witness ${witness.witnessId}: missing assignment ${name}`);
    for (const variable of scenario.domain.variables) {
      const assignment = witness.assignments.find((item) => item.name === variable.name);
      if (!assignment) continue;
      const value = assignment.value;
      if (variable.values && !variable.values.includes(value)) problems.push(`witness assignment outside declared set: ${variable.name}`);
      if (variable.type === "int" && (typeof value !== "number" || !Number.isSafeInteger(value) || (variable.min !== undefined && value < variable.min) || (variable.max !== undefined && value > variable.max) || (variable.step !== undefined && (value - (variable.min ?? 0)) % variable.step !== 0))) problems.push(`witness assignment outside declared range: ${variable.name}`);
    }
  }
  return problems;
}
