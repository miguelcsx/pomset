/**
 * The restricted integer-expression model.
 *
 * A launch configuration is serializable data — a tree over `literal`,
 * `parameter`, `add`, `subtract`, `multiply`, `floorDivide`, `ceilDivide` and
 * `modulo` — and never executable host code. Parameter names resolve only to
 * declared domain variables; a divisor must be provably positive under the
 * constraints; a resulting grid dimension must be provably nonnegative. A
 * display hint such as `triton.cdiv` is human-facing text and is never parsed
 * back into semantics.
 *
 * The same evaluator is used by scenario validation and, later, by the
 * extractor, so the two cannot drift.
 */

import type { IntExpr, LaunchConfig } from "@pomset/contracts";

import {
  UNKNOWN_SIGN,
  isVariableProvablyPositive,
  provesVariableRelation,
  signsOfVariable,
  type DomainModel,
  type Sign,
  type SignSet,
} from "./domain.js";
import { accepted, inputInvalid, pointer, rejected, type Validated, type Rejection } from "./rejection.js";

export type BinaryOp = Exclude<IntExpr["op"], "literal" | "parameter">;

export function parametersOf(spec: IntExpr): readonly string[] {
  const found = new Set<string>();
  const walk = (node: IntExpr): void => {
    if (node.op === "parameter" && node.parameter) found.add(node.parameter);
    for (const operand of node.operands ?? []) walk(operand);
  };
  walk(spec);
  return [...found];
}

function isLiteral(spec: IntExpr): spec is IntExpr & { value: number } {
  return spec.op === "literal" && typeof spec.value === "number";
}

/** Evaluates the tree at a concrete domain point. */
export function evaluateIntExpr(
  spec: IntExpr,
  bindings: Readonly<Record<string, number>>,
): Validated<number> {
  switch (spec.op) {
    case "literal":
      if (typeof spec.value !== "number") {
        return rejected(inputInvalid("", "a literal node carries no value"));
      }
      return accepted(spec.value);
    case "parameter": {
      const name = spec.parameter ?? "";
      const value = bindings[name];
      if (value === undefined) {
        return rejected(inputInvalid("", `parameter ${name} is not bound at this domain point`));
      }
      return accepted(value);
    }
    default:
      break;
  }

  const operands = spec.operands ?? [];
  if (operands.length !== 2) {
    return rejected(
      inputInvalid("", `operator ${spec.op} takes exactly two operands, found ${operands.length}`),
    );
  }
  const [leftNode, rightNode] = operands as [IntExpr, IntExpr];
  const left = evaluateIntExpr(leftNode, bindings);
  if (!left.ok) return left;
  const right = evaluateIntExpr(rightNode, bindings);
  if (!right.ok) return right;

  switch (spec.op) {
    case "add":
      return accepted(left.value + right.value);
    case "subtract":
      return accepted(left.value - right.value);
    case "multiply":
      return accepted(left.value * right.value);
    case "floorDivide":
      if (right.value === 0) {
        return rejected(inputInvalid("", "floorDivide by zero"));
      }
      return accepted(Math.floor(left.value / right.value));
    case "ceilDivide":
      if (right.value === 0) {
        return rejected(inputInvalid("", "ceilDivide by zero"));
      }
      return accepted(Math.ceil(left.value / right.value));
    case "modulo":
      if (right.value === 0) {
        return rejected(inputInvalid("", "modulo by zero"));
      }
      return accepted(((left.value % right.value) + right.value) % right.value);
    default:
      return rejected(inputInvalid("", `unknown operator ${spec.op}`));
  }
}

function has(signs: SignSet, sign: Sign): boolean {
  return signs.includes(sign);
}

/** Products of two sign sets: the sign of a product depends only on the signs. */
function multiplySigns(left: SignSet, right: SignSet): SignSet {
  const numeric = (sign: Sign): number => (sign === "negative" ? -1 : sign === "zero" ? 0 : 1);
  const out = new Set<Sign>();
  for (const a of left) {
    for (const b of right) {
      const product = numeric(a) * numeric(b);
      out.add(product < 0 ? "negative" : product === 0 ? "zero" : "positive");
    }
  }
  return [...out];
}

/**
 * The sign of a sum. A positive and a negative of unknown magnitude may sum to
 * anything, so their sum is every sign: treating it as zero because -1 + 1 = 0
 * would miss a real negative.
 */
function addSignPair(left: Sign, right: Sign): SignSet {
  if (left === "zero") return [right];
  if (right === "zero") return [left];
  if (left === right) return [left];
  return ["negative", "zero", "positive"];
}

/** Sums of two sign sets. */
function addSigns(left: SignSet, right: SignSet): SignSet {
  const out = new Set<Sign>();
  for (const a of left) {
    for (const b of right) {
      for (const sign of addSignPair(a, b)) out.add(sign);
    }
  }
  return [...out];
}

/**
 * The signs an expression may take, given the declared domain. Kept sound: it
 * never claims a sign the declaration does not prove, so a refusal is always
 * safe and an acceptance is only for a provable case.
 */
export function signOfExpression(spec: IntExpr, model: DomainModel): SignSet {
  switch (spec.op) {
    case "literal":
      if (typeof spec.value !== "number") return UNKNOWN_SIGN;
      return [spec.value < 0 ? "negative" : spec.value === 0 ? "zero" : "positive"];
    case "parameter":
      return signsOfVariable(model, spec.parameter ?? "");
    default:
      break;
  }

  const operands = spec.operands ?? [];
  if (operands.length !== 2) return UNKNOWN_SIGN;
  const [leftNode, rightNode] = operands as [IntExpr, IntExpr];
  const left = signOfExpression(leftNode, model);
  const right = signOfExpression(rightNode, model);

  switch (spec.op) {
    case "add":
      return addSigns(left, right);
    case "subtract":
      return addSigns(left, multiplySigns(right, ["negative"]));
    case "multiply":
      return multiplySigns(left, right);
    case "floorDivide":
    case "ceilDivide": {
      // Only a strictly positive divisor gives an analysable result.
      if (right.length !== 1 || right[0] !== "positive") return UNKNOWN_SIGN;
      if (!has(left, "negative")) return left.filter((sign) => sign !== "negative");
      return UNKNOWN_SIGN;
    }
    case "modulo": {
      if (right.length !== 1 || right[0] !== "positive") return UNKNOWN_SIGN;
      if (!has(left, "negative")) return ["zero", "positive"];
      return UNKNOWN_SIGN;
    }
    default:
      return UNKNOWN_SIGN;
  }
}

/** Whether the declaration proves the expression strictly positive. */
export function isProvablyPositive(spec: IntExpr, model: DomainModel): boolean {
  if (isLiteral(spec)) return spec.value > 0;
  if (spec.op === "parameter") {
    const name = spec.parameter ?? "";
    return (
      isVariableProvablyPositive(model, name) ||
      provesVariableRelation(model, name, "gt", 0) ||
      provesVariableRelation(model, name, "ge", 1)
    );
  }
  const signs = signOfExpression(spec, model);
  return signs.length === 1 && signs[0] === "positive";
}

/** Whether the declaration proves the expression nonnegative. */
export function isProvablyNonNegative(spec: IntExpr, model: DomainModel): boolean {
  const signs = signOfExpression(spec, model);
  return signs.length > 0 && signs.every((sign) => sign !== "negative");
}

export interface LaunchEvaluation {
  /** Provable sign of each grid dimension, in declaration order. */
  readonly gridSigns: readonly SignSet[];
  /** Whether every divisor in the tree is provably positive. */
  readonly divisorsProvablyPositive: boolean;
}

/**
 * Validates the launch configuration against the declared domain: every
 * parameter resolves, every divisor is provably positive, and every resulting
 * grid dimension is provably nonnegative. A failure is an explicit rejection
 * with the offending subexpression quoted, never a clamp.
 */
export function validateLaunch(
  launch: LaunchConfig,
  model: DomainModel,
  at: string,
): Validated<LaunchEvaluation> {
  const rejections: Rejection[] = [];

  const checkTree = (spec: IntExpr, path: string): void => {
    if (spec.op === "parameter") {
      const name = spec.parameter ?? "";
      if (!model.variables.has(name)) {
        rejections.push(
          inputInvalid(
            path,
            `launch parameter ${name} resolves to no declared domain variable`,
            { parameter: name },
          ),
        );
      }
      return;
    }
    if ((spec.op === "floorDivide" || spec.op === "ceilDivide" || spec.op === "modulo") && spec.operands) {
      const divisor = spec.operands[1] as IntExpr | undefined;
      if (divisor && !isProvablyPositive(divisor, model)) {
        rejections.push(
          inputInvalid(path, `divisor of ${spec.op} is not provably positive`, {
            divisor: describe(divisor),
          }),
        );
      }
    }
    for (const [index, operand] of (spec.operands ?? []).entries()) {
      checkTree(operand, `${path}/operands/${index}`);
    }
  };

  const checkDimensions = (dimensions: readonly IntExpr[], path: string): SignSet[] => {
    const signs: SignSet[] = [];
    dimensions.forEach((dimension, index) => {
      checkTree(dimension, `${path}/${index}`);
      const sign = signOfExpression(dimension, model);
      if (sign.length === 0 || sign.includes("negative")) {
        rejections.push(
          inputInvalid(`${path}/${index}`, "grid dimension is not provably nonnegative", {
            expression: describe(dimension),
          }),
        );
      }
      signs.push(sign);
    });
    return signs;
  };

  const gridSigns = checkDimensions(launch.grid, `${at}/grid`);
  for (const [index, dimension] of launch.block.entries()) {
    checkTree(dimension, `${at}/block/${index}`);
  }
  if (launch.numWarps) checkTree(launch.numWarps, `${at}/numWarps`);
  if (launch.numStages) checkTree(launch.numStages, `${at}/numStages`);

  if (rejections.length > 0) return rejected(...rejections);
  return accepted({ gridSigns, divisorsProvablyPositive: true });
}

/** A short, stable rendering of an expression, for a rejection message. */
export function describe(spec: IntExpr): string {
  switch (spec.op) {
    case "literal":
      return String(spec.value ?? "?");
    case "parameter":
      return spec.parameter ?? "?";
    default:
      return `${spec.op}(${(spec.operands ?? []).map(describe).join(", ")})`;
  }
}

/** The JSON pointer of a launch member, for a rejection. */
export function launchPointer(...segments: readonly string[]): string {
  return pointer("launch", ...segments);
}
