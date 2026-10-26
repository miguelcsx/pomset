"""The OpenMP engine entry point.

Launched by the supervisor with a fixed argv vector ending in ``--request
<path>``, it reads its identity from that read-only request file and writes the
line protocol on stdout. It never reads its identity from the environment and
never takes authority from a path a scenario supplied.

Unlike the symbolic engine, this one compiles and runs the kernel. That is the
whole point of the backend and also the reason it refuses to start without
consent: reading a kernel and running it are different acts, and `REQ-CLI-011`
requires the flag on the invocation that does the second one.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from pomset_contracts.engine_protocol import InputInvalid, Unsupported, validate

from .analysis import analyse
from .protocol import CAPABILITIES, ENGINE_NAME, ENGINE_VERSION, Session, read_request

# Every operation this engine offers executes the kernel, which is why the
# consent gate below covers all of them rather than a subset.
OPERATIONS = {"full", "validate"}


def _resolve_inputs(request: dict) -> tuple[str, str]:
    scenario_path = None
    files_root = None
    for entry in request.get("inputs", []):
        if entry.get("kind") == "scenario":
            scenario_path = entry.get("path")
        elif entry.get("kind") == "files":
            files_root = entry.get("path")
    if scenario_path is None:
        raise InputInvalid("the request maps no scenario input")
    if files_root is None:
        raise InputInvalid("the request maps no files input")
    return scenario_path, files_root


def _consented(request: dict) -> bool:
    consent = request.get("consent") or {}
    return bool(consent.get("granted"))


def run(request_path: str) -> int:
    request = read_request(request_path)
    session = Session(
        job_id=request["jobId"],
        attempt_id=request["attemptId"],
        engine_name=ENGINE_NAME,
        engine_version=ENGINE_VERSION,
    )
    session.hello(CAPABILITIES)

    operation = request.get("operation", "full")
    if operation not in OPERATIONS:
        session.error(
            "INPUT_INVALID",
            f"operation {operation} is not offered by this engine",
            {"operation": operation},
        )
        return 1
    if not _consented(request):
        session.error(
            "INPUT_INVALID",
            "this backend compiles and runs the kernel, so it requires --trust-local-code "
            "for this invocation; consent is never carried over from an earlier one",
            {"operation": operation, "flag": "--trust-local-code"},
        )
        return 1

    try:
        scenario_path, files_root = _resolve_inputs(request)
        with open(scenario_path, encoding="utf-8") as handle:
            scenario = json.load(handle)
        validate(scenario, "domain.schema.yaml#/$defs/scenario")
        if (
            scenario["scenarioId"] != request["scenarioId"]
            or scenario["snapshotId"] != request["snapshotId"]
            or scenario["domain"]["domainId"] != request["domainRef"]
        ):
            raise InputInvalid("request provenance does not match the mapped scenario")

        root = Path(files_root).resolve()
        entrypoint = (root / scenario["entrypoint"]["path"]).resolve()
        if not entrypoint.is_relative_to(root) or not entrypoint.is_file():
            raise InputInvalid(
                "the entrypoint escapes its mapped root or is not a file"
            )
        if any(
            part.is_symlink()
            for part in [entrypoint, *entrypoint.parents]
            if part.is_relative_to(root)
        ):
            raise InputInvalid("the entrypoint uses a symlink")

        session.progress("compile", 0, 1, "building the kernel and its driver")
        result = analyse(request, scenario, root, session)
        validate(result, "evidence.schema.yaml#/$defs/analysisResult")
        session.result(result)
        return 0
    except Unsupported as unsupported:
        session.error(
            "INPUT_INVALID",
            f"unsupported construct: {unsupported.construct}",
            {
                "construct": unsupported.construct,
                "line": unsupported.line,
                "column": unsupported.column,
            },
        )
        return 1
    except InputInvalid as invalid:
        session.error("INPUT_INVALID", str(invalid))
        return 1
    except Exception as error:  # noqa: BLE001 - the boundary turns any fault into a record
        session.error("ENGINE_FAILED", f"{type(error).__name__}: {error}")
        return 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--request", required=True)
    arguments = parser.parse_args(argv)
    return run(arguments.request)


if __name__ == "__main__":
    raise SystemExit(main())
