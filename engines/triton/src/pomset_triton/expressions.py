"""Typed integer expressions with exact modular wraparound and interval bounds."""

from __future__ import annotations

import ast
from dataclasses import dataclass
import z3

from .extract import builtin, unsupported
from .parse import InputInvalid, Unsupported


@dataclass(frozen=True)
class Integer:
    value: z3.ArithRef
    lo: int
    hi: int
    width: str = "i32"


def limits(width: str) -> tuple[int, int]:
    if width not in {"i32", "u32", "i64", "u64"}:
        raise Unsupported(f"integer width {width}", 1, 0)
    bits = int(width[1:])
    return (
        (-(1 << (bits - 1)), (1 << (bits - 1)) - 1)
        if width[0] == "i"
        else (0, (1 << bits) - 1)
    )


def integer(value: z3.ArithRef | int, lo: int, hi: int, width: str = "i32") -> Integer:
    lower, upper = limits(width)
    expression = z3.IntVal(value) if isinstance(value, int) else value
    if lo < lower or hi > upper:
        expression = (expression - lower) % (upper - lower + 1) + lower
        lo, hi = lower, upper
    return Integer(z3.simplify(expression), lo, hi, width)


def binary(op: str, left: Integer, right: Integer) -> Integer:
    if left.width[0] != right.width[0]:
        raise Unsupported("mixed signed/unsigned arithmetic", 1, 0)
    width = left.width[0] + str(max(int(left.width[1:]), int(right.width[1:])))
    a, b = left.value, right.value
    if op == "add":
        return integer(a + b, left.lo + right.lo, left.hi + right.hi, width)
    if op == "subtract":
        return integer(a - b, left.lo - right.hi, left.hi - right.lo, width)
    if op == "multiply":
        corners = [x * y for x in (left.lo, left.hi) for y in (right.lo, right.hi)]
        return integer(a * b, min(corners), max(corners), width)
    if op in {"floorDivide", "ceilDivide", "modulo"}:
        if right.lo <= 0:
            raise Unsupported("divisor is not provably positive", 1, 0)
        if op == "modulo":
            return integer(a % b, 0, right.hi - 1, width)
        rounding = 0 if op == "floorDivide" else 1
        corners = [
            x // y if rounding == 0 else -(-x // y)
            for x in (left.lo, left.hi)
            for y in (right.lo, right.hi)
        ]
        expression = a / b if rounding == 0 else -((-a) / b)
        return integer(expression, min(corners), max(corners), width)
    raise Unsupported(f"integer operator {op}", 1, 0)


def portable(node: dict, variables: dict[str, Integer]) -> Integer:
    if node["op"] == "literal":
        value = node["value"]
        if type(value) is not int:
            raise InputInvalid("integer expression literal is not an integer")
        return integer(
            value, value, value, "i32" if -(1 << 31) <= value < (1 << 31) else "i64"
        )
    if node["op"] == "parameter":
        if node["parameter"] not in variables:
            raise InputInvalid(f"undeclared numeric parameter {node['parameter']}")
        return variables[node["parameter"]]
    operands = node.get("operands", [])
    if len(operands) != 2:
        raise InputInvalid("binary integer expression requires two operands")
    return binary(node["op"], *(portable(operand, variables) for operand in operands))


def comparison(relation: str, a: z3.ArithRef, b: z3.ArithRef) -> z3.BoolRef:
    return {
        "lt": a < b,
        "le": a <= b,
        "eq": a == b,
        "ne": a != b,
        "ge": a >= b,
        "gt": a > b,
    }[relation]


def source(
    node: ast.expr, variables: dict[str, Integer], pid: Integer, lane: Integer
) -> Integer | z3.BoolRef:
    if isinstance(node, ast.Constant):
        if type(node.value) is bool:
            return z3.BoolVal(node.value)
        if type(node.value) is int:
            if not -(1 << 63) <= node.value < (1 << 63):
                raise unsupported(
                    node, "integer literal outside supported signed widths"
                )
            width = "i32" if -(1 << 31) <= node.value < (1 << 31) else "i64"
            return integer(node.value, node.value, node.value, width)
    if isinstance(node, ast.Name) and node.id in variables:
        return variables[node.id]
    if isinstance(node, ast.Call):
        if builtin(node) == "program_id":
            return pid
        if builtin(node) == "arange":
            return lane
        raise unsupported(node, "data-dependent address or mask")
    if isinstance(node, ast.BinOp):
        left, right = (
            source(node.left, variables, pid, lane),
            source(node.right, variables, pid, lane),
        )
        if (
            isinstance(node.op, (ast.BitAnd, ast.BitOr))
            and z3.is_bool(left)
            and z3.is_bool(right)
        ):
            return (
                z3.And(left, right)
                if isinstance(node.op, ast.BitAnd)
                else z3.Or(left, right)
            )
        operators = {
            ast.Add: "add",
            ast.Sub: "subtract",
            ast.Mult: "multiply",
            ast.FloorDiv: "floorDivide",
            ast.Mod: "modulo",
        }
        if (
            type(node.op) in operators
            and isinstance(left, Integer)
            and isinstance(right, Integer)
        ):
            return binary(operators[type(node.op)], left, right)
    if isinstance(node, ast.UnaryOp):
        operand = source(node.operand, variables, pid, lane)
        if isinstance(node.op, (ast.Not, ast.Invert)) and z3.is_bool(operand):
            return z3.Not(operand)
        if isinstance(node.op, ast.USub) and isinstance(operand, Integer):
            return binary("subtract", integer(0, 0, 0, operand.width), operand)
    if isinstance(node, ast.Compare):
        relations = {
            ast.Lt: "lt",
            ast.LtE: "le",
            ast.Eq: "eq",
            ast.NotEq: "ne",
            ast.GtE: "ge",
            ast.Gt: "gt",
        }
        expressions = [node.left, *node.comparators]
        terms = [source(expr, variables, pid, lane) for expr in expressions]
        if (
            all(isinstance(term, Integer) for term in terms)
            and len({term.width[0] for term in terms}) > 1
        ):
            raise unsupported(node, "mixed-signedness comparison")
        if all(isinstance(term, Integer) for term in terms) and all(
            type(op) in relations for op in node.ops
        ):
            return z3.And(
                [
                    comparison(relations[type(op)], a.value, b.value)
                    for op, a, b in zip(node.ops, terms, terms[1:])
                ]
            )
    if isinstance(node, ast.BoolOp):
        values = [source(value, variables, pid, lane) for value in node.values]
        if all(z3.is_bool(value) for value in values):
            return z3.And(values) if isinstance(node.op, ast.And) else z3.Or(values)
    raise unsupported(node, f"address/mask expression {ast.unparse(node)}")
