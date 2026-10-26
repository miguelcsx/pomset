/**
 * What a scenario is.
 *
 * A scenario carries exactly one entrypoint, the declared allocations with their
 * roles, dtypes, shapes and strides, the launch expression, the declared
 * required properties and any declared reference computation. It belongs to
 * exactly one snapshot. The value is immutable: a change produces a new value,
 * and nothing here infers an aliasing relationship the scenario did not declare.
 */

import type {
  Allocation,
  AliasGroup,
  IntExpr,
  ReferenceComputation,
  Scenario as ScenarioRecord,
} from "@pomset/contracts";

import { createWorkloadDomain, type DomainModel } from "./domain.js";
import { validateLaunch } from "./expr.js";
import { isAdmissibleProperty } from "./properties.js";
import { accepted, inputInvalid, pointer, rejected, type Validated, type Rejection } from "./rejection.js";

/** The identifier shape the contract uses for symbols and parameter names. */
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

export interface ScenarioModel {
  readonly scenario: ScenarioRecord;
  readonly domain: DomainModel;
  readonly allocations: ReadonlyMap<string, Allocation>;
  readonly aliasGroups: ReadonlyMap<string, AliasGroup>;
}

/**
 * Builds the immutable scenario model, refusing a scenario that violates any
 * invariant the contract cannot express as a shape. Every refusal is a
 * machine-readable rejection with the offending JSON pointer.
 */
export function createScenario(scenario: ScenarioRecord): Validated<ScenarioModel> {
  const rejections: Rejection[] = [];

  // Exactly one entrypoint: the contract carries a single object, so the
  // invariant here is that it is present, complete and a valid symbol.
  if (!scenario.entrypoint.path) {
    rejections.push(inputInvalid(pointer("entrypoint", "path"), "an entrypoint must name its file"));
  }
  if (!IDENTIFIER.test(scenario.entrypoint.symbol)) {
    rejections.push(
      inputInvalid(pointer("entrypoint", "symbol"), "entrypoint symbol is not a valid identifier", {
        symbol: scenario.entrypoint.symbol,
      }),
    );
  }

  if (scenario.allocations.length === 0) {
    rejections.push(inputInvalid(pointer("allocations"), "a scenario must declare its allocations"));
  }

  const allocations = new Map<string, Allocation>();
  scenario.allocations.forEach((allocation, index) => {
    const at = pointer("allocations", String(index));
    if (allocations.has(allocation.allocationId)) {
      rejections.push(
        inputInvalid(pointer(at, "allocationId"), `duplicate allocation id ${allocation.allocationId}`),
      );
    }
    if (allocation.shape.length === 0) {
      rejections.push(inputInvalid(pointer(at, "shape"), `allocation ${allocation.name} has no shape`));
    }
    allocations.set(allocation.allocationId, allocation);
  });

  // Aliasing is declared, never inferred. A group must list at least two
  // distinct declared allocations.
  const aliasGroups = new Map<string, AliasGroup>();
  for (const [index, group] of (scenario.aliasGroups ?? []).entries()) {
    const at = pointer("aliasGroups", String(index));
    const members = new Set(group.allocationIds);
    if (members.size < 2) {
      rejections.push(
        inputInvalid(at, `alias group ${group.aliasGroupId} must list at least two allocations`),
      );
    }
    for (const id of members) {
      if (!allocations.has(id)) {
        rejections.push(
          inputInvalid(at, `alias group ${group.aliasGroupId} names undeclared allocation ${id}`),
        );
      }
    }
    if (aliasGroups.has(group.aliasGroupId)) {
      rejections.push(
        inputInvalid(at, `duplicate alias group id ${group.aliasGroupId}`),
      );
    }
    aliasGroups.set(group.aliasGroupId, group);
  }

  // Required properties come from the shared vocabulary or an explicit
  // project-local `x-` extension.
  if (scenario.requiredProperties.length === 0) {
    rejections.push(
      inputInvalid(
        pointer("requiredProperties"),
        "a scenario must declare its required properties; there is no default set",
      ),
    );
  }
  scenario.requiredProperties.forEach((property, index) => {
    if (!isAdmissibleProperty(property)) {
      rejections.push(
        inputInvalid(
          pointer("requiredProperties", String(index)),
          `property ${property} is neither a known property nor an x- extension`,
          { property },
        ),
      );
    }
  });

  // The domain, and the launch expression evaluated against it.
  const domain = createWorkloadDomain(scenario.domain);
  if (!domain.ok) {
    rejections.push(
      ...domain.rejections.map((rejection) => ({
        record: rejection.record,
        pointer: pointer("domain", ...rejection.pointer.split("/").filter(Boolean)),
      })),
    );
  } else {
    const launch = validateLaunch(scenario.launch, domain.value, "launch");
    if (!launch.ok) rejections.push(...launch.rejections);
  }

  if (scenario.reference) {
    const reference = validateReference(scenario.reference, allocations);
    rejections.push(...reference);
  }

  if (rejections.length > 0) return rejected(...rejections);
  if (!domain.ok) return rejected(...rejections);
  return accepted({
    scenario,
    domain: domain.value,
    allocations,
    aliasGroups,
  });
}

/**
 * A declared reference computation must name a resolvable kind, and the
 * tolerances it will be compared under. Whether it can be executed is a
 * separate question, answered by the local execution consent.
 */
function validateReference(
  reference: ReferenceComputation,
  allocations: ReadonlyMap<string, Allocation>,
): ReturnType<typeof inputInvalid>[] {
  const rejections = [];
  const at = pointer("reference");
  if (reference.kind !== "none" && !reference.path) {
    rejections.push(inputInvalid(pointer(at, "path"), "a declared reference must name its file"));
  }
  if (reference.kind !== "none" && !reference.symbol) {
    rejections.push(inputInvalid(pointer(at, "symbol"), "a declared reference must name its symbol"));
  }
  if (allocations.size === 0) {
    rejections.push(inputInvalid(at, "a reference computation needs at least one output allocation"));
  }
  if (reference.tolerances.atol < 0 || reference.tolerances.rtol < 0) {
    rejections.push(inputInvalid(pointer(at, "tolerances"), "tolerances are never negative"));
  }
  return rejections;
}

/**
 * The allocations that may overlap this one: its alias group, or itself alone.
 * The model never infers aliasing, so an allocation outside a declared group
 * cannot produce a conflict that depends on an undeclared overlap.
 */
export function aliasingAllocations(
  model: ScenarioModel,
  allocationId: string,
): readonly string[] {
  for (const group of model.aliasGroups.values()) {
    if (group.allocationIds.includes(allocationId)) return [...group.allocationIds];
  }
  return [allocationId];
}

/** Every parameter any launch dimension references. */
export function launchParameters(model: ScenarioModel): readonly string[] {
  const found = new Set<string>();
  const walk = (spec: IntExpr): void => {
    if (spec.op === "parameter" && spec.parameter) found.add(spec.parameter);
    for (const operand of spec.operands ?? []) walk(operand);
  };
  for (const dimension of model.scenario.launch.grid) walk(dimension);
  for (const dimension of model.scenario.launch.block) walk(dimension);
  if (model.scenario.launch.numWarps) walk(model.scenario.launch.numWarps);
  if (model.scenario.launch.numStages) walk(model.scenario.launch.numStages);
  return [...found];
}
