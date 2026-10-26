import { expect, it } from "vitest";
import { expression, expressionText } from "./expressions.js";
it("preserves precedence and canonical AST structure", () => {
  expect(expression("N + BLOCK * 2")).toEqual({ op: "add", operands: [{ op: "parameter", parameter: "N" }, { op: "multiply", operands: [{ op: "parameter", parameter: "BLOCK" }, { op: "literal", value: 2 }] }] });
  for (const text of ["ceildiv(N, BLOCK)", "N // BLOCK", "(N - 1) % BLOCK", "(N + 2) * 3"]) expect(expression(expressionText(expression(text)))).toEqual(expression(text));
});
it("rejects executable syntax, invalid expressions and excessive nesting", () => {
  for (const text of ["", "N / BLOCK", "N +", "__import__('os')", "N.foo", "9007199254740992", "(".repeat(201)]) expect(() => expression(text)).toThrow();
});
