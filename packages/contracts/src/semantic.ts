/** Additional semantic checks over shape-validated records, without executing code. */
import type { AnalysisResult, IntExpr, Scenario } from "./generated/index.js";
import { evidenceLinkProblems } from "./evidence-links.js";

export function semanticProblems(value: unknown, scenario?: Scenario): string[] {
  const problems: string[] = [];
  const walk = (node: unknown, path: string) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach((item, index) => walk(item, `${path}/${index}`)); return; }
    const object = node as Record<string, unknown>;
    if (["floorDivide", "ceilDivide", "modulo"].includes(String(object["op"]))) {
      const operands = object["operands"] as readonly IntExpr[] | undefined;
      if (operands?.[1]?.op === "literal" && (operands[1].value ?? 0) <= 0) problems.push(`${path}: literal divisor must be positive`);
    }
    for (const [key, item] of Object.entries(object)) walk(item, `${path}/${key}`);
  };
  walk(value, "");
  if (scenario && value && typeof value === "object" && "propertyResults" in value) {
    problems.push(...evidenceLinkProblems(value as AnalysisResult, scenario));
  }
  return problems;
}
