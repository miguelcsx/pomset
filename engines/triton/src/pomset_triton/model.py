"""One validated domain, launch and allocation model for every query."""

from __future__ import annotations

import ast
import time
import z3

from .expressions import Integer, comparison, limits, portable, source
from .extract import Access, Extraction
from .parse import InputInvalid, Unsupported


class BudgetExpired(Exception):
    pass


class SolverInconclusive(Exception):
    pass


class Model:
    def __init__(self, scenario: dict, extraction: Extraction, timeout_ms: int):
        self.scenario = scenario
        self.extraction = extraction
        self.deadline = time.monotonic() + timeout_ms / 1000
        self.constraints = []
        self.variables: dict[str, Integer] = {}
        self.other_variables = {}
        for variable in scenario["domain"]["variables"]:
            name = variable["name"]
            if name in self.variables or name in self.other_variables:
                raise InputInvalid(f"duplicate domain variable {name}")
            values = variable.get("values")
            if values and not all(type(value) is int for value in values):
                if variable["type"] == "int":
                    raise InputInvalid(f"non-integer values in {name}")
                self.other_variables[name] = values
                continue
            if values is not None:
                if not values:
                    raise InputInvalid(f"empty variable {name}")
                lo, hi = min(values), max(values)
            else:
                lo, hi = variable.get("min"), variable.get("max")
                if lo is None or hi is None:
                    raise Unsupported(f"unbounded variable {name}", 1, 0)
            width = variable.get("width", "i32")
            lower, upper = limits(width)
            if lo > hi or lo < lower or hi > upper:
                raise InputInvalid(
                    f"domain variable {name} is empty or outside {width}"
                )
            symbol = z3.FreshInt(name)
            self.variables[name] = Integer(symbol, lo, hi, width)
            self.constraints += [symbol >= lo, symbol <= hi]
            if values is not None:
                self.constraints.append(
                    z3.Or([symbol == value for value in set(values)])
                )
            elif variable.get("step", 1) != 1:
                step = variable["step"]
                if step <= 0:
                    raise InputInvalid(f"non-positive step for {name}")
                self.constraints.append((symbol - lo) % step == 0)
        for constraint in scenario["domain"].get("constraints", []):
            left = portable(constraint["lhs"], self.variables)
            right = portable(constraint["rhs"], self.variables)
            if left.width[0] != right.width[0]:
                raise Unsupported("mixed-signedness domain comparison", 1, 0)
            self.constraints.append(
                comparison(constraint["relation"], left.value, right.value)
            )
        if self.check() == z3.unsat:
            raise InputInvalid("declared domain is empty or contradictory")
        if (
            len(scenario["launch"]["grid"]) != 1
            or len(scenario["launch"]["block"]) != 1
        ):
            raise Unsupported("multidimensional launch", 1, 0)
        self.grid = portable(scenario["launch"]["grid"][0], self.variables)
        if self.grid.hi >= (1 << 31):
            raise Unsupported("launch exceeds the modeled i32 program-id range", 1, 0)
        if extraction.block_size:
            self.block = source(
                ast.parse(extraction.block_size, mode="eval").body,
                self.variables,
                Integer(z3.IntVal(0), 0, 0),
                Integer(z3.IntVal(0), 0, 0),
            )
        else:
            self.block = portable(scenario["launch"]["block"][0], self.variables)
        if not isinstance(self.block, Integer):
            raise InputInvalid("lane bound must be an integer")
        if self.check(z3.Or(self.grid.value < 0, self.block.value <= 0)) != z3.unsat:
            raise InputInvalid(
                "launch extents are not provably nonnegative with positive lane bounds"
            )
        if scenario.get("aliasGroups") or any(
            allocation.get("aliasGroupId") for allocation in scenario["allocations"]
        ):
            raise Unsupported("alias groups require a relative-base model", 1, 0)
        self.allocations = {}
        for allocation in scenario["allocations"]:
            name = allocation["name"]
            if name in self.allocations:
                raise InputInvalid(f"duplicate allocation name {name}")
            if len(allocation["shape"]) != 1 or allocation.get("strides"):
                raise Unsupported("non-contiguous or multidimensional allocation", 1, 0)
            extent = portable(allocation["shape"][0], self.variables)
            if self.check(extent.value <= 0) != z3.unsat:
                raise InputInvalid(f"allocation {name} extent is not provably positive")
            self.allocations[name] = (allocation, extent)
        for access in extraction.accesses:
            if access.pointer not in self.allocations:
                raise InputInvalid(
                    f"access names undeclared allocation {access.pointer}"
                )

    def solver(self, *extra):
        remaining = int((self.deadline - time.monotonic()) * 1000)
        if remaining <= 0:
            raise BudgetExpired()
        solver = z3.Solver()
        solver.set(timeout=remaining)
        solver.add(*self.constraints, *extra)
        return solver

    def check(self, *extra):
        solver = self.solver(*extra)
        answer = solver.check()
        if answer == z3.unknown:
            raise SolverInconclusive(solver.reason_unknown())
        return answer

    def coordinates(self, suffix=""):
        pid = Integer(z3.FreshInt("program" + suffix), 0, max(0, self.grid.hi - 1))
        lane = Integer(z3.FreshInt("lane" + suffix), 0, self.block.hi - 1)
        active = z3.And(
            pid.value >= 0,
            pid.value < self.grid.value,
            lane.value >= 0,
            lane.value < self.block.value,
        )
        return pid, lane, active

    def access(self, access: Access, pid: Integer, lane: Integer):
        offset = source(access.offset, self.variables, pid, lane)
        mask = source(access.mask, self.variables, pid, lane)
        if not isinstance(offset, Integer) or not z3.is_bool(mask):
            raise Unsupported(
                "integer address and boolean mask required", access.line, access.column
            )
        return offset, mask

    def assignments(self, model):
        values = {
            name: model.eval(term.value, model_completion=True).as_long()
            for name, term in self.variables.items()
        }
        values.update(
            {name: options[0] for name, options in self.other_variables.items()}
        )
        return values
