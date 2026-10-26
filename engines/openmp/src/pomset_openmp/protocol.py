"""The OpenMP engine's identity, and what it announces it can do.

The envelope belongs to the protocol package, which every engine writes the same
way. What is OpenMP's is its name, its version and — the part that matters — the
list of what it can actually do here, with the reason for anything it cannot.
"""

from __future__ import annotations

from pomset_contracts.engine_protocol import (
    PROTOCOL_VERSION,
    Session,
    read_request,
)

__all__ = [
    "CAPABILITIES",
    "ENGINE_NAME",
    "ENGINE_VERSION",
    "PROTOCOL_VERSION",
    "Session",
    "read_request",
]

ENGINE_NAME = "pomset-openmp"
ENGINE_VERSION = "0.1.0"

# What this engine offers is decided by what the machine can do, not by what the
# product would like. The probe measures both and the answer travels with every
# result: an instrumented capability that cannot run here is announced as
# unavailable with its measured reason, never left out and never approximated.
CAPABILITIES = [
    {
        "feature": "compilation",
        "support": "limited",
        "reason": "one C entrypoint compiled by the pinned Clang; no template or C++ semantics",
    },
    {
        "feature": "numericalReference",
        "support": "limited",
        "reason": "the declared reference is compared value by value over enumerated domain points",
    },
    {
        "feature": "initializationDiagnostics",
        "support": "limited",
        "reason": "output buffers are freshly poisoned, so an element no store reached is detected",
    },
]
