"""Bounded finite-domain enumeration with constraints and duplicate removal.

What the declared domain enumerates to is policy, not a backend's opinion: two
engines that disagree about which points a scenario describes are analysing
different scenarios. It lives here for that reason.
"""

from itertools import product
import json

from pomset_contracts.engine_protocol import InputInvalid, Unsupported

MAX_ENUMERATED_POINTS = 100_000


def evaluate(node: dict, bindings: dict, widths: dict) -> tuple[int, str]:
    op = node["op"]
    if op == "literal":
        value = node["value"]
        width = "i32" if -(1 << 31) <= value < (1 << 31) else "i64"
    elif op == "parameter":
        name = node["parameter"]
        if name not in bindings or type(bindings[name]) is not int:
            raise InputInvalid(f"undeclared numeric variable {name}")
        value, width = bindings[name], widths[name]
    else:
        (a, wa), (b, wb) = [
            evaluate(operand, bindings, widths) for operand in node["operands"]
        ]
        if wa[0] != wb[0]:
            raise Unsupported("mixed signed/unsigned arithmetic", 1, 0)
        width = wa[0] + str(max(int(wa[1:]), int(wb[1:])))
        if op in {"floorDivide", "ceilDivide", "modulo"} and b <= 0:
            raise InputInvalid("divisor must be positive")
        if op == "add":
            value = a + b
        elif op == "subtract":
            value = a - b
        elif op == "multiply":
            value = a * b
        elif op == "floorDivide":
            value = a // b
        elif op == "ceilDivide":
            value = -(-a // b)
        elif op == "modulo":
            value = a % b
        else:
            raise InputInvalid(f"unknown operator {op}")
    bits = int(width[1:])
    lower = -(1 << (bits - 1)) if width[0] == "i" else 0
    return (value - lower) % (1 << bits) + lower, width


def enumerated_points(domain: dict) -> list[dict]:
    axes = []
    names = []
    widths = {}
    total = 1
    for variable in domain["variables"]:
        name = variable["name"]
        if name in names:
            raise InputInvalid(f"duplicate domain variable {name}")
        names.append(name)
        widths[name] = variable.get("width", "i32")
        if "values" in variable:
            unique = {
                json.dumps(value, sort_keys=True): value for value in variable["values"]
            }
            values = list(unique.values())
        elif "min" in variable and "max" in variable:
            step = variable.get("step", 1)
            if step <= 0:
                raise InputInvalid("domain step must be positive")
            count = max(0, (variable["max"] - variable["min"]) // step + 1)
            if total * count > MAX_ENUMERATED_POINTS:
                return []
            values = range(variable["min"], variable["max"] + 1, step)
        else:
            return []
        total *= len(values)
        if not total or total > MAX_ENUMERATED_POINTS:
            return []
        axes.append(values)
    points = []
    for values in product(*axes):
        bindings = dict(zip(names, values))
        valid = True
        for constraint in domain.get("constraints", []):
            a, wa = evaluate(constraint["lhs"], bindings, widths)
            b, wb = evaluate(constraint["rhs"], bindings, widths)
            if wa[0] != wb[0]:
                raise Unsupported("mixed-signedness domain comparison", 1, 0)
            relation = constraint["relation"]
            if not {
                "lt": a < b,
                "le": a <= b,
                "eq": a == b,
                "ne": a != b,
                "ge": a >= b,
                "gt": a > b,
            }[relation]:
                valid = False
                break
        if valid:
            points.append(bindings)
    return points


def widths_of(domain: dict) -> dict[str, str]:
    """The declared integer width of every numeric variable."""
    return {variable["name"]: variable.get("width", "i32") for variable in domain["variables"]}
