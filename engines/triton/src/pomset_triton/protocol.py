"""The engine side of the line protocol.

One `hello`, then progress, then a terminal `result` or `error` — each message a
single JSON object on its own line, each numbered from 1 in its own direction.
stderr carries diagnostics only. The engine reads its identity from the request
file it was launched with and never from the environment or from a scenario.
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from typing import Any

PROTOCOL_VERSION = 1
ENGINE_NAME = "pomset-triton"
ENGINE_VERSION = "0.2.0"


@dataclass
class Session:
    """Writes one engine conversation, numbering its own sequence."""

    job_id: str
    attempt_id: str
    stream: Any = sys.stdout
    sequence: int = 0

    def send(self, message_type: str, payload: dict[str, Any]) -> None:
        self.sequence += 1
        envelope = {
            "protocolVersion": PROTOCOL_VERSION,
            "jobId": self.job_id,
            "attemptId": self.attempt_id,
            "sequence": self.sequence,
            "type": message_type,
            "payload": payload,
        }
        self.stream.write(json.dumps(envelope) + "\n")
        self.stream.flush()

    def hello(self, capabilities: list[dict[str, str]]) -> None:
        self.send(
            "hello",
            {
                "engineName": ENGINE_NAME,
                "engineVersion": ENGINE_VERSION,
                "capabilities": capabilities,
                "limits": {"maxMessageBytes": 1_048_576, "maxOutputBytes": 16_777_216},
            },
        )

    def progress(
        self, phase: str, completed: int, total: int, note: str | None = None
    ) -> None:
        payload: dict[str, Any] = {
            "phase": phase,
            "completed": completed,
            "total": total,
        }
        if note:
            payload["note"] = note
        self.send("progress", payload)

    def result(self, analysis_result: dict[str, Any]) -> None:
        self.send("result", analysis_result)

    def error(
        self, code: str, message: str, details: dict[str, Any] | None = None
    ) -> None:
        payload: dict[str, Any] = {"code": code, "message": message}
        if details:
            payload["details"] = details
        self.send("error", payload)


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


def read_request(path: str) -> dict[str, Any]:
    with open(path, encoding="utf-8") as handle:
        request = json.load(handle)
    from .validation import validate

    validate(request, "engine.schema.yaml#/$defs/engineRequest")
    return request
