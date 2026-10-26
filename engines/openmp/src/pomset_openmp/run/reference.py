"""The declared reference computation, and the comparison against it.

The reference is the scenario's own statement of what the kernel should compute.
Loading it imports user Python, so it is only reached under the consent that
covers a numerical reference — reading a kernel and running anything it names
are different acts.

Agreement is decided against the tolerances the scenario declares, never exact
equality. A sum of floats taken in a different order is a different number, and
treating that as a defect would make every parallel reduction a defect. The first
element that differs is reported with both values, because "these disagree" is
not a finding anyone can act on.
"""

from __future__ import annotations

import importlib.util
import math
from pathlib import Path
from typing import Any, Callable

from pomset_contracts.engine_protocol import InputInvalid


def load(
    scenario: dict, files_root: Path
) -> tuple[Callable[..., Any] | None, str | None]:
    """The declared reference function, or the reason there is none to call."""
    declaration = scenario.get("reference")
    if not declaration:
        return None, "the scenario declares no reference computation"
    kind = declaration.get("kind")
    if kind == "none":
        return None, "the scenario declares no reference computation"
    if kind not in {"numpy", "host-python"}:
        return None, f"a {kind} reference is not runnable by this engine"
    path = declaration.get("path")
    symbol = declaration.get("symbol")
    if not path or not symbol:
        return None, "the declared reference names no file or no symbol"

    target = (files_root / path).resolve()
    if not target.is_relative_to(files_root.resolve()) or not target.is_file():
        raise InputInvalid(
            f"the declared reference {path} is not among the captured files"
        )

    specification = importlib.util.spec_from_file_location("pomset_reference", target)
    if specification is None or specification.loader is None:
        raise InputInvalid(f"{path} cannot be loaded as a module")
    module = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(module)
    function = getattr(module, symbol, None)
    if function is None:
        raise InputInvalid(f"{path} declares no {symbol}")
    return function, None


def agree(
    observed: float, expected: float, atol: float, rtol: float, nan_policy: str
) -> bool:
    """Whether two numbers agree under the tolerances the scenario declared."""
    if math.isnan(observed) or math.isnan(expected):
        return (
            nan_policy == "equal-nan" and math.isnan(observed) and math.isnan(expected)
        )
    if math.isinf(observed) or math.isinf(expected):
        return observed == expected
    return abs(observed - expected) <= atol + rtol * abs(expected)


def compare(
    observed: list[float],
    expected: list[float],
    tolerances: dict,
    poison: float,
) -> dict:
    """What one run said about its output: unwritten, wrong, or agreeing.

    An element still holding the poison was reached by no store, which is a
    different failure from one that was written with the wrong value — and the
    difference is the whole reason the buffers are poisoned.
    """
    atol = float(tolerances.get("atol", 0.0))
    rtol = float(tolerances.get("rtol", 0.0))
    nan_policy = tolerances.get("nanPolicy", "reject-nan")

    if len(observed) != len(expected):
        return {
            "verdict": "mismatched",
            "detail": f"the kernel wrote {len(observed)} elements where {len(expected)} were declared",
        }

    unwritten = [index for index, value in enumerate(observed) if value == poison]
    if unwritten:
        return {
            "verdict": "unwritten",
            "first": unwritten[0],
            "count": len(unwritten),
        }

    differing = [
        index
        for index in range(len(observed))
        if not agree(observed[index], expected[index], atol, rtol, nan_policy)
    ]
    if differing:
        first = differing[0]
        return {
            "verdict": "differs",
            "first": first,
            "observed": observed[first],
            "expected": expected[first],
            "count": len(differing),
        }
    return {"verdict": "agrees"}
