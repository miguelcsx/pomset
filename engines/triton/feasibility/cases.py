"""Finite adversarial cases for the existing coverage implementation.

Expected answers come from explicit finite writes, independently of the solver.
This oracle checks this tiny pattern only; it is not a third-party baseline or
a GPU execution. It does not import the kernel.
"""

from __future__ import annotations

from copy import deepcopy
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[3]


def cases() -> list[dict]:
    scenario = json.loads(
        (ROOT / "examples/transform-floor-grid/scenario.json").read_text()
    )
    source = (ROOT / "examples/transform-floor-grid/kernels/transform.py").read_text()
    output = []
    for name, n, ceil, mutation in (
        ("floor-remainder", 1025, False, "none"),
        ("floor-exact", 1024, False, "none"),
        ("ceil-control", 1025, True, "none"),
        ("reordered-domain", 1025, False, "reorder"),
        ("different-mask", 1025, True, "mask"),
        ("stepped-domain", 1024, False, "step"),
        ("output-extent", 1024, True, "extent"),
    ):
        document = deepcopy(scenario)
        variables = document["domain"]["variables"]
        variables[0].update(min=n, max=n)
        variables[1]["values"] = [256]
        variables[2]["values"] = ["fp16"]
        if ceil:
            document["launch"]["grid"][0]["op"] = "ceilDivide"
        kernel = source
        mask_bound = "N"
        extent = n
        if mutation == "reorder":
            variables[0], variables[1] = variables[1], variables[0]
        elif mutation == "mask":
            mask_bound = "BLOCK"
            kernel = source.replace("mask = offsets < N", "mask = offsets < BLOCK")
        elif mutation == "step":
            variables[0].update(max=1025, step=2)
        elif mutation == "extent":
            extent = 1025
            document["allocations"][1]["shape"] = [{"op": "literal", "value": extent}]
        grid = (n + 255) // 256 if ceil else n // 256
        enabled = {
            pid * 256 + lane
            for pid in range(grid)
            for lane in range(256)
            if pid * 256 + lane < (n if mask_bound == "N" else 256)
        }
        holes = sorted(set(range(extent)) - enabled)
        output.append(
            {
                "caseId": name,
                "scenario": document,
                "source": kernel,
                "expected": "sat" if holes else "unsat",
                "oracle": {
                    "method": "finite-pattern-enumeration",
                    "revision": "1",
                    "assignments": {"N": n, "BLOCK": 256, "dtype": "fp16"},
                    "grid": grid,
                    "outputExtent": extent,
                    "maskBound": mask_bound,
                    "firstUnwrittenIndex": holes[0] if holes else None,
                    "limitations": "Single finite point; no GPU or numeric value semantics.",
                },
            }
        )
    return output
