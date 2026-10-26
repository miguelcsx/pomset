"""The Triton engine's identity, and what it announces it can do.

The envelope itself belongs to the protocol package, which every engine writes
the same way. What is Triton's is its name, its version and its capability list.
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

ENGINE_NAME = "pomset-triton"
ENGINE_VERSION = "0.2.0"

CAPABILITIES = [
    {
        "feature": "parse",
        "support": "limited",
        "reason": "the supported subset is deliberately tiny",
    },
    {
        "feature": "outputCoverage",
        "support": "limited",
        "reason": "contiguous one-dimensional allocations; unsupported constructs are named",
    },
    {
        "feature": "bounds",
        "support": "limited",
        "reason": "typed one-dimensional addresses and boolean masks",
    },
    {
        "feature": "writeWriteConflict",
        "support": "limited",
        "reason": "distinct program/lane actors, non-atomic writes, disjoint allocations",
    },
]
