"""Additional contextual rules over shape-validated portable records."""


def semantic_problems(value: object, scenario: dict | None = None) -> list[str]:
    problems: list[str] = []

    def walk(node: object, path: str) -> None:
        if isinstance(node, list):
            for index, item in enumerate(node):
                walk(item, f"{path}/{index}")
        elif isinstance(node, dict):
            if node.get("op") in ("floorDivide", "ceilDivide", "modulo"):
                operands = node.get("operands", [])
                if len(operands) == 2 and operands[1].get("op") == "literal":
                    if operands[1]["value"] <= 0:
                        problems.append(f"{path}: literal divisor must be positive")
            for key, item in node.items():
                walk(item, f"{path}/{key}")

    walk(value, "")
    if scenario is None or not isinstance(value, dict):
        return problems
    required = set()

    def parameters(expr: dict) -> None:
        if expr.get("op") == "parameter":
            required.add(expr["parameter"])
        for operand in expr.get("operands", []):
            parameters(operand)

    for expr in scenario["launch"]["grid"] + scenario["launch"].get("block", []):
        parameters(expr)
    for allocation in scenario["allocations"]:
        for expr in allocation["shape"] + allocation.get("strides", []):
            parameters(expr)
    for constraint in scenario["domain"].get("constraints", []):
        parameters(constraint["lhs"])
        parameters(constraint["rhs"])
    for witness in value.get("witnesses", []):
        assigned = [item["name"] for item in witness["assignments"]]
        if len(assigned) != len(set(assigned)):
            problems.append("duplicate witness assignments")
        for name in sorted(required - set(assigned)):
            problems.append(
                f"witness {witness['witnessId']}: missing assignment {name}"
            )
    return problems
