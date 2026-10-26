/**
 * The workload domain is the central model.
 *
 * A domain is declared, never inferred, and it is a machine-checkable
 * conjunction over its declared variables: shape, dtype, layout, strides, launch
 * configuration and hardware cohort. This module turns the portable
 * `WorkloadDomain` record into the model the launch evaluator and, later, the
 * symbolic extractor reason over, and it refuses a domain that is empty,
 * carries a variable of an unsupported kind, or whose constraints cannot be
 * checked.
 */

import type { DomainVariable, IntConstraint, IntExpr, WorkloadDomain } from "@pomset/contracts";

import { inputInvalid, pointer, rejected, accepted, type Validated, type Rejection } from "./rejection.js";

/**
 * The variable kinds the product models: shape, dtype, layout/strides, launch
 * configuration and hardware, which are the families the contract enumerates.
 */
export const SUPPORTED_VARIABLE_KINDS = [
  "shape",
  "dtype",
  "layout",
  "stride",
  "launch",
  "blockSize",
  "warps",
  "stages",
  "hardware",
] as const;

export type VariableKind = (typeof SUPPORTED_VARIABLE_KINDS)[number];

const KIND_SET: ReadonlySet<string> = new Set(SUPPORTED_VARIABLE_KINDS);

/** A possible sign of an integer expression: coarse but always sound. */
export type Sign = "negative" | "zero" | "positive";

/** The set of signs a value may take. An empty set means no value is possible. */
export type SignSet = readonly Sign[];

export const SIGNS: Readonly<Record<"negative" | "zero" | "positive", SignSet>> = {
  negative: ["negative"],
  zero: ["zero"],
  positive: ["positive"],
};

/** Every sign: nothing is known. */
export const UNKNOWN_SIGN: SignSet = ["negative", "zero", "positive"];

export interface VariableBounds {
  readonly min?: number;
  readonly max?: number;
  readonly values?: readonly number[];
  readonly valuesAreExhaustive: boolean;
}

export interface DomainModel {
  readonly domain: WorkloadDomain;
  readonly variables: ReadonlyMap<string, DomainVariable>;
  readonly constraints: readonly IntConstraint[];
}

function isConcrete(spec: IntExpr): spec is IntExpr & { op: "literal"; value: number } {
  return spec.op === "literal" && typeof spec.value === "number";
}

/** The variables a constraint mentions. */
function parametersOf(spec: IntExpr, into: Set<string>): void {
  if (spec.op === "parameter" && spec.parameter) into.add(spec.parameter);
  for (const operand of spec.operands ?? []) parametersOf(operand, into);
}

/**
 * Validates a declared domain and returns the model derived from it. Nothing is
 * inferred: a variable the domain does not declare does not exist.
 */
export function createWorkloadDomain(domain: WorkloadDomain): Validated<DomainModel> {
  const rejections: Rejection[] = [];
  const declaredConstraints = domain.constraints ?? [];

  if (domain.variables.length === 0) {
    rejections.push(inputInvalid(pointer("variables"), "a domain must declare at least one variable"));
  }
  if (declaredConstraints.length === 0) {
    rejections.push(
      inputInvalid(
        pointer("constraints"),
        "a domain must carry its constraints; an empty constraint set is not an unconstrained domain",
      ),
    );
  }

  const variables = new Map<string, DomainVariable>();
  domain.variables.forEach((variable, index) => {
    const at = pointer("variables", String(index));
    if (variables.has(variable.name)) {
      rejections.push(inputInvalid(pointer(at, "name"), `duplicate domain variable ${variable.name}`));
    }
    if (!KIND_SET.has(variable.kind)) {
      rejections.push(
        inputInvalid(
          pointer(at, "kind"),
          `domain variable kind ${variable.kind} is not modelled`,
          { supported: [...SUPPORTED_VARIABLE_KINDS] },
        ),
      );
    }
    if (variable.type === "int" && variable.values === undefined && variable.min === undefined) {
      rejections.push(
        inputInvalid(
          pointer(at),
          `integer variable ${variable.name} declares neither a value set nor a range`,
        ),
      );
    }
    if (variable.type !== "int" && variable.values === undefined) {
      rejections.push(
        inputInvalid(
          pointer(at, "values"),
          `${variable.type} variable ${variable.name} must enumerate its values`,
        ),
      );
    }
    if (
      variable.type === "int" &&
      variable.min !== undefined &&
      variable.max !== undefined &&
      variable.min > variable.max
    ) {
      rejections.push(
        inputInvalid(pointer(at), `variable ${variable.name} has an empty range`, {
          min: variable.min,
          max: variable.max,
        }),
      );
    }
    variables.set(variable.name, variable);
  });

  declaredConstraints.forEach((constraint, index) => {
    const at = pointer("constraints", String(index));
    const mentioned = new Set<string>();
    parametersOf(constraint.lhs, mentioned);
    parametersOf(constraint.rhs, mentioned);
    if (mentioned.size === 0) {
      rejections.push(
        inputInvalid(at, `constraint ${constraint.constraintId} mentions no domain variable`),
      );
    }
    for (const name of mentioned) {
      if (!variables.has(name)) {
        rejections.push(
          inputInvalid(at, `constraint ${constraint.constraintId} names undeclared variable ${name}`),
        );
      }
    }
    // A contradiction that is visible without a solver: a literal bound that no
    // declared value can satisfy.
    if (
      constraint.relation === "eq" &&
      isConcrete(constraint.lhs) &&
      isConcrete(constraint.rhs) &&
      constraint.lhs.value !== constraint.rhs.value
    ) {
      rejections.push(
        inputInvalid(at, `constraint ${constraint.constraintId} is unsatisfiable`),
      );
    }
  });

  if (rejections.length > 0) return rejected(...rejections);
  return accepted({ domain, variables, constraints: declaredConstraints });
}

/** The declared bounds of one variable, as far as they are declared. */
export function boundsOf(model: DomainModel, name: string): VariableBounds | undefined {
  const variable = model.variables.get(name);
  if (!variable) return undefined;
  const numericValues = (variable.values ?? []).filter(
    (value): value is number => typeof value === "number",
  );
  const bounds: VariableBounds = {
    valuesAreExhaustive: numericValues.length > 0,
    ...(numericValues.length > 0 ? { values: numericValues } : {}),
    ...(variable.min !== undefined ? { min: variable.min } : {}),
    ...(variable.max !== undefined ? { max: variable.max } : {}),
  };
  return bounds;
}

/** The signs one variable may take under its declaration and constraints. */
export function signsOfVariable(model: DomainModel, name: string): SignSet {
  const bounds = boundsOf(model, name);
  if (!bounds) return UNKNOWN_SIGN;
  if (bounds.values) {
    const signs = new Set<Sign>();
    for (const value of bounds.values) {
      signs.add(value < 0 ? "negative" : value === 0 ? "zero" : "positive");
    }
    return [...signs];
  }
  const signs = new Set<Sign>();
  const min = bounds.min ?? Number.NEGATIVE_INFINITY;
  const max = bounds.max ?? Number.POSITIVE_INFINITY;
  if (min < 0) signs.add("negative");
  if (min <= 0 && max >= 0) signs.add("zero");
  if (max > 0) signs.add("positive");
  return [...signs];
}

function signOf(value: number): Sign {
  return value < 0 ? "negative" : value === 0 ? "zero" : "positive";
}

/** The sign of the expression under a concrete assignment. */
export function concreteSign(spec: IntExpr, bindings: Readonly<Record<string, number>>): Sign {
  const evaluate = (node: IntExpr): number => {
    switch (node.op) {
      case "literal":
        return node.value ?? 0;
      case "parameter":
        return bindings[node.parameter ?? ""] ?? 0;
      default: {
        const [left, right] = (node.operands ?? []).map(evaluate);
        if (left === undefined || right === undefined) return 0;
        switch (node.op) {
          case "add":
            return left + right;
          case "subtract":
            return left - right;
          case "multiply":
            return left * right;
          case "floorDivide":
            return right === 0 ? 0 : Math.floor(left / right);
          case "ceilDivide":
            return right === 0 ? 0 : Math.ceil(left / right);
          case "modulo":
            return right === 0 ? 0 : ((left % right) + right) % right;
          default:
            return 0;
        }
      }
    }
  };
  return signOf(evaluate(spec));
}

/** Whether the declaration proves this variable strictly positive. */
export function isVariableProvablyPositive(model: DomainModel, name: string): boolean {
  const variable = model.variables.get(name);
  const bounds = boundsOf(model, name);
  if (!variable || !bounds) return false;
  if (bounds.values && bounds.values.length > 0) {
    return bounds.values.every((value) => value > 0);
  }
  return bounds.min !== undefined && bounds.min >= 1;
}

/**
 * Whether the domain's constraints prove a simple `variable relation literal`.
 * Only the forms this product models are recognised; anything else is not
 * proved, and an unproved divisor is refused rather than assumed.
 */
export function provesVariableRelation(
  model: DomainModel,
  name: string,
  relation: string,
  value: number,
): boolean {
  for (const constraint of model.constraints) {
    if (constraint.lhs.op !== "parameter" || constraint.lhs.parameter !== name) continue;
    if (!isConcrete(constraint.rhs)) continue;
    const bound = constraint.rhs.value;
    switch (constraint.relation) {
      case "gt":
        if (relation === "gt" && bound >= value) return true;
        if (relation === "ge" && bound + 1 >= value) return true;
        break;
      case "ge":
        if (relation === "gt" && bound > value) return true;
        if (relation === "ge" && bound >= value) return true;
        break;
      case "lt":
        if (relation === "lt" && bound <= value) return true;
        if (relation === "le" && bound - 1 <= value) return true;
        break;
      case "le":
        if (relation === "lt" && bound < value) return true;
        if (relation === "le" && bound <= value) return true;
        break;
      case "eq":
        if (relation === "eq" && bound === value) return true;
        break;
      default:
        break;
    }
  }
  return false;
}

/**
 * Enumerates every declared point when all variables are enumerable and the
 * product is bounded; otherwise the domain is not enumerable and no count or
 * percentage may be derived from it.
 */
export const MAX_ENUMERATED_POINTS = 100_000;

export function enumerateDomain(
  model: DomainModel,
): readonly Readonly<Record<string, number>>[] | undefined {
  const names: string[] = [];
  const choices: number[][] = [];
  for (const [name, variable] of model.variables) {
    if (variable.type !== "int") return undefined;
    const bounds = boundsOf(model, name);
    if (!bounds) return undefined;
    if (bounds.values) {
      names.push(name);
      choices.push([...bounds.values]);
      continue;
    }
    if (bounds.min === undefined || bounds.max === undefined) return undefined;
    const step = variable.step ?? 1;
    if (step <= 0) return undefined;
    const values: number[] = [];
    for (let value = bounds.min; value <= bounds.max; value += step) values.push(value);
    if (values.length === 0) return undefined;
    names.push(name);
    choices.push(values);
  }

  const total = choices.reduce((product, values) => product * values.length, 1);
  if (total === 0 || total > MAX_ENUMERATED_POINTS) return undefined;

  const points: Record<string, number>[] = [];
  const walk = (index: number, current: Record<string, number>): void => {
    if (index === names.length) {
      points.push({ ...current });
      return;
    }
    const name = names[index] as string;
    for (const value of choices[index] as number[]) {
      current[name] = value;
      walk(index + 1, current);
    }
  };
  walk(0, {});
  return points;
}
