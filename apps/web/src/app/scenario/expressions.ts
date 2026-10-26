/** Editable notation for the canonical integer AST; no JavaScript evaluation. */
import type { IntExpr } from "@pomset/contracts";
export function expression(text: string): IntExpr {
  const tokens = text.match(/ceildiv|[A-Za-z_][A-Za-z_0-9]*|\d+|\/\/|[()+*,%-]/g) ?? [];
  if (tokens.join("") !== text.replace(/\s/g, "") || tokens.length > 200) throw new Error("Use integers, names, +, -, *, //, %, and ceildiv(a, b).");
  let index = 0;
  function atom(): IntExpr {
    const token = tokens[index++];
    if (token === "-") return { op: "subtract", operands: [{ op: "literal", value: 0 }, atom()] };
    if (token === "(") { const value = sum(); if (tokens[index++] !== ")") throw new Error("Missing closing parenthesis"); return value; }
    if (token === "ceildiv") { if (tokens[index++] !== "(") throw new Error("Use ceildiv(a, b)"); const a = sum(); if (tokens[index++] !== ",") throw new Error("Use ceildiv(a, b)"); const b = sum(); if (tokens[index++] !== ")") throw new Error("Missing closing parenthesis"); return { op: "ceilDivide", operands: [a, b] }; }
    if (token && /^\d+$/.test(token)) { const value = Number(token); if (!Number.isSafeInteger(value)) throw new Error("Integer exceeds the portable numeric range"); return { op: "literal", value }; }
    if (token && /^[A-Za-z_][A-Za-z_0-9]*$/.test(token)) return { op: "parameter", parameter: token };
    throw new Error("Expected an integer or parameter");
  }
  function product(): IntExpr { let value = atom(); while (["*", "//", "%"].includes(tokens[index] ?? "")) { const token = tokens[index++]; value = { op: token === "*" ? "multiply" : token === "//" ? "floorDivide" : "modulo", operands: [value, atom()] }; } return value; }
  function sum(): IntExpr { let value = product(); while (["+", "-"].includes(tokens[index] ?? "")) { const token = tokens[index++]; value = { op: token === "+" ? "add" : "subtract", operands: [value, product()] }; } return value; }
  const result = sum(); if (index !== tokens.length) throw new Error("Unexpected expression token"); return result;
}
export function expressionText(value: IntExpr): string {
  if (value.op === "literal") return String(value.value);
  if (value.op === "parameter") return value.parameter ?? "";
  const [a, b] = (value.operands ?? []).map(expressionText);
  if (value.op === "ceilDivide") return `ceildiv(${a}, ${b})`;
  const operator = { add: "+", subtract: "-", multiply: "*", floorDivide: "//", modulo: "%" }[value.op];
  return `(${a} ${operator} ${b})`;
}
