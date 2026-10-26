"""The engine side of the line protocol, and the tool helpers a native engine needs.

One ``hello``, then progress, then a terminal ``result`` or ``error`` — each
message a single JSON object on its own line, each numbered from 1 in its own
direction. stderr carries diagnostics only. An engine reads its identity from
the request file it was launched with, never from the environment and never from
a scenario.

This is a contract before it is code: :file:`docs/srs/engine-protocol.md` fixes
the envelope and the supervisor validates it. It lives here, in the package every
engine depends on, so that adding a backend adds an engine rather than a second
copy of the protocol.

The refusals an engine may raise are here too, so a second engine reports them
the same way. They carry no exit status: the engine's ``__main__`` maps them to
an error envelope, and the supervisor and the CLI decide what that means.
"""

from __future__ import annotations

import json
import math
import subprocess
import sys
import time
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from pomset_contracts.check import load_registry, validator_for

PROTOCOL_VERSION = 1


class EngineError(Exception):
    """A refusal the engine reports as an error envelope rather than crashing."""


class InputInvalid(EngineError):
    """The request, the scenario or the source cannot be used as given."""


class Unsupported(EngineError):
    """A construct outside the model this engine declares.

    A refusal names the construct and where it is. An unsupported construct is a
    statement about the kernel, not a crash: the caller learns what was not
    analysed instead of guessing whether it was.
    """

    def __init__(self, construct: str, line: int, column: int) -> None:
        super().__init__(f"{construct} is outside the modelled subset")
        self.construct = construct
        self.line = line
        self.column = column


@dataclass
class Session:
    """Writes one engine conversation, numbering its own sequence."""

    job_id: str
    attempt_id: str
    engine_name: str
    engine_version: str
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
                "engineName": self.engine_name,
                "engineVersion": self.engine_version,
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


@lru_cache
def validator(target: str):
    """A validator for ``file.schema.yaml#/$defs/name``, built once per process."""
    registry, schemas = load_registry()
    return validator_for(schemas, registry, target)


def validate(value: object, target: str) -> None:
    """Refuses a document that is not canonical, including unportable numbers.

    JSON is the wire format and it is also what the canonical form hashes, so a
    number outside the interoperable range is a refusal rather than something
    that silently changes value on the way through.
    """

    def portable(node: object, path: str = "") -> None:
        if type(node) is int and abs(node) > (1 << 53) - 1:
            raise InputInvalid(
                f"{path}: integer outside interoperable JSON range; decimal encoding required"
            )
        if type(node) is float and not math.isfinite(node):
            raise InputInvalid(f"{path}: non-finite JSON number")
        if isinstance(node, dict):
            for key, item in node.items():
                portable(item, f"{path}/{key}")
        elif isinstance(node, list):
            for index, item in enumerate(node):
                portable(item, f"{path}/{index}")

    portable(value)
    errors = list(validator(target).iter_errors(value))
    if errors:
        first = errors[0]
        pointer = "/" + "/".join(str(part) for part in first.absolute_path)
        raise InputInvalid(f"{pointer}: {first.message}")


def read_request(path: str) -> dict[str, Any]:
    """Reads the request this engine was launched with, and refuses a stale one."""
    with open(path, encoding="utf-8") as handle:
        request = json.load(handle)
    validate(request, "engine.schema.yaml#/$defs/engineRequest")
    return request


def command(
    argv: list[str],
    timeout_seconds: float,
    env: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Runs one tool invocation, bounded, and reports what actually happened.

    A timeout is recorded as an unknown outcome with its reason, never as a
    failure of the program under test: a clock cannot tell a program that is
    stuck from one that is slow, and the product is not allowed to pretend
    otherwise.

    `env` replaces the environment when given. It is how a run is given a thread
    count, which is part of what is being observed rather than a detail of the
    harness.
    """
    started = time.perf_counter_ns()
    try:
        run = subprocess.run(
            argv,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            env=env,
        )
        return {
            "argv": argv,
            "exitCode": run.returncode,
            "stdout": run.stdout,
            "stderr": run.stderr,
            "elapsedNs": time.perf_counter_ns() - started,
        }
    except subprocess.TimeoutExpired:
        return {
            "argv": argv,
            "exitCode": None,
            "stdout": "",
            "stderr": "",
            "elapsedNs": time.perf_counter_ns() - started,
            "reason": "timeout; progress unknown",
        }
    except OSError as error:
        return {
            "argv": argv,
            "exitCode": None,
            "stdout": "",
            "stderr": str(error),
            "elapsedNs": time.perf_counter_ns() - started,
            "reason": f"the tool could not be started: {error}",
        }


def stage(name: str, invocation: dict[str, Any], evidence: str) -> dict[str, Any]:
    """One named step, with the outcome the invocation actually had."""
    exit_code = invocation["exitCode"]
    return {
        "stage": name,
        "status": "unknown" if exit_code is None else "passed" if exit_code == 0 else "failed",
        "evidenceClass": evidence,
        "invocation": invocation,
    }


def first_failure(stages: list[dict[str, Any]]) -> dict[str, Any] | None:
    """The first stage that did not pass, or ``None`` when every stage did."""
    for item in stages:
        if item["status"] != "passed":
            return item
    return None
