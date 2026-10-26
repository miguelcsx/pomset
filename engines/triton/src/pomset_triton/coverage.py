"""Bounds, output-coverage and distinct-writer queries over one typed model."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
import z3

from .extract import Extraction
from .model import BudgetExpired, Model, SolverInconclusive
from .parse import Unsupported

MODEL_NAME = "triton-address-and-mask"
MODEL_REVISION = "3"


@dataclass(frozen=True)
class CoverageAnswer:
    status: str
    solver_version: str
    witness: dict[str, Any] | None = None
    reason: str | None = None
    assumptions: tuple[str, ...] = field(default_factory=tuple)
    property_id: str = "outputCoverage"


def is_numeric(variable: dict) -> bool:
    return (
        variable["type"] == "int"
        or bool(variable.get("values"))
        and all(type(value) is int for value in variable["values"])
    )


def query(
    scenario: dict, extraction: Extraction, timeout_ms: int, property_id: str
) -> CoverageAnswer:
    try:
        model = Model(scenario, extraction, timeout_ms)
        if property_id == "outputCoverage":
            predicate, metadata = coverage_query(model)
        elif property_id == "memoryBounds":
            predicate, metadata = bounds_query(model)
        elif property_id == "writeWriteConflict":
            predicate, metadata = conflict_query(model)
        else:
            raise Unsupported(f"property {property_id}", 1, 0)
        solver = model.solver(predicate)
        result = solver.check()
        if result == z3.unknown:
            raise SolverInconclusive(solver.reason_unknown())
        if result == z3.unsat:
            return CoverageAnswer(
                "unsat", z3.get_version_string(), property_id=property_id
            )
        solution = solver.model()
        selected = next(
            item
            for condition, item in metadata
            if z3.is_true(solution.eval(condition, model_completion=True))
        )
        objective = selected.get("index", selected.get("address"))
        minimization = {
            "attempted": False,
            "droppedAssumptions": 0,
            "note": "No numeric witness objective is available.",
        }
        if isinstance(objective, z3.ArithRef):
            minimization["attempted"] = True
            try:
                smaller = model.solver(predicate, objective < solution.eval(objective))
                reduced = smaller.check()
                if reduced == z3.sat:
                    solution = smaller.model()
                    selected = next(
                        item
                        for condition, item in metadata
                        if z3.is_true(solution.eval(condition, model_completion=True))
                    )
                    minimization["note"] = (
                        "A smaller witness was found; global minimality is not claimed. All assumptions retained."
                    )
                elif reduced == z3.unsat:
                    minimization["note"] = (
                        "No smaller objective exists under this query; all assumptions retained."
                    )
                else:
                    minimization["note"] = (
                        "Minimization was inconclusive; original valid witness retained."
                    )
            except BudgetExpired:
                minimization["note"] = (
                    "Minimization budget expired; original valid witness retained."
                )
        witness = {
            "assignments": model.assignments(solution),
            "grid": solution.eval(model.grid.value).as_long(),
            "block": solution.eval(model.block.value).as_long(),
            "property": property_id,
            "minimization": minimization,
        }
        for key, value in selected.items():
            if isinstance(value, z3.ExprRef):
                evaluated = solution.eval(value, model_completion=True)
                witness[key] = (
                    evaluated.as_long()
                    if z3.is_int_value(evaluated)
                    else str(evaluated)
                )
            else:
                witness[key] = value
        return CoverageAnswer(
            "sat", z3.get_version_string(), witness, property_id=property_id
        )
    except Unsupported as error:
        return CoverageAnswer(
            "unsupported",
            z3.get_version_string(),
            reason=str(error),
            property_id=property_id,
        )
    except SolverInconclusive as error:
        return CoverageAnswer(
            "unknown",
            z3.get_version_string(),
            reason=f"solver inconclusive: {error}",
            property_id=property_id,
        )
    except BudgetExpired:
        return CoverageAnswer(
            "unknown",
            z3.get_version_string(),
            reason=f"solver budget exhausted ({timeout_ms} ms)",
            property_id=property_id,
        )


def coverage_query(model: Model):
    pid, lane, active = model.coordinates()
    index = z3.FreshInt("output_index")
    clauses = []
    metadata = []
    for allocation, extent in model.allocations.values():
        if allocation["role"] != "output":
            continue
        stores = [
            (i, access)
            for i, access in enumerate(model.extraction.accesses)
            if access.kind == "store" and access.pointer == allocation["name"]
        ]
        if not stores:
            raise Unsupported(f"output {allocation['name']} has no modeled store", 1, 0)
        writes = []
        inverse_writes = []
        for _, access in stores:
            offset, mask = model.access(access, pid, lane)
            writes.append(z3.And(mask, offset.value == index))
            contiguous = z3.simplify(
                offset.value == pid.value * model.block.value + lane.value
            )
            if z3.is_true(contiguous):
                inverse_writes.append(
                    z3.substitute(
                        z3.And(active, mask),
                        (pid.value, index / model.block.value),
                        (lane.value, index % model.block.value),
                    )
                )
        if len(inverse_writes) == len(stores):
            absent = z3.Not(z3.Or(inverse_writes))
        else:
            absent = z3.ForAll(
                [pid.value, lane.value], z3.Implies(active, z3.Not(z3.Or(writes)))
            )
        hole = z3.And(index >= 0, index < extent.value, absent)
        clauses.append(hole)
        metadata.append(
            (
                hole,
                {
                    "index": index,
                    "allocationId": allocation["allocationId"],
                    "accessIndices": [i for i, _ in stores],
                    "mask": " or ".join(
                        access.mask_expression or "True" for _, access in stores
                    ),
                },
            )
        )
    if not clauses:
        raise Unsupported("output coverage requires a declared output", 1, 0)
    return z3.Or(clauses), metadata


def bounds_query(model: Model):
    pid, lane, active = model.coordinates()
    clauses = []
    metadata = []
    for i, access in enumerate(model.extraction.accesses):
        offset, mask = model.access(access, pid, lane)
        allocation, extent = model.allocations[access.pointer]
        invalid = z3.And(
            active, mask, z3.Or(offset.value < 0, offset.value >= extent.value)
        )
        clauses.append(invalid)
        metadata.append(
            (
                invalid,
                {
                    "address": offset.value,
                    "program": pid.value,
                    "lane": lane.value,
                    "allocationId": allocation["allocationId"],
                    "accessIndices": [i],
                },
            )
        )
    return z3.Or(clauses), metadata


def conflict_query(model: Model):
    p1, l1, active1 = model.coordinates("_a")
    p2, l2, active2 = model.coordinates("_b")
    distinct = z3.Or(p1.value != p2.value, l1.value != l2.value)
    clauses = []
    metadata = []
    stores = [
        (i, access)
        for i, access in enumerate(model.extraction.accesses)
        if access.kind == "store"
    ]
    for position, (i, first) in enumerate(stores):
        for j, second in stores[position:]:
            if first.pointer != second.pointer:
                continue
            a, mask_a = model.access(first, p1, l1)
            b, mask_b = model.access(second, p2, l2)
            conflict = z3.And(
                active1, active2, distinct, mask_a, mask_b, a.value == b.value
            )
            clauses.append(conflict)
            metadata.append(
                (
                    conflict,
                    {
                        "address": a.value,
                        "programA": p1.value,
                        "laneA": l1.value,
                        "programB": p2.value,
                        "laneB": l2.value,
                        "accessIndices": [i, j],
                        "allocationId": model.allocations[first.pointer][0][
                            "allocationId"
                        ],
                    },
                )
            )
    return z3.Or(clauses), metadata


def output_coverage(
    scenario: dict, extraction: Extraction, timeout_ms: int
) -> CoverageAnswer:
    return query(scenario, extraction, timeout_ms, "outputCoverage")
