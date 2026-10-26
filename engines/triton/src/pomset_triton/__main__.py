"""The Triton engine entry point.

Launched by the supervisor as a child process with a fixed argv vector ending in
``--request <path>``, it reads its identity from that read-only request file,
writes the line protocol on stdout, and keeps diagnostics on stderr. It never
reads its identity from the environment and never takes authority from a path
that a scenario supplied.
"""

from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path

from .analysis import build_analysis_result
from .coverage import CoverageAnswer, query
from .extract import extract
from .parse import InputInvalid, Unsupported, select_entrypoint
from .protocol import CAPABILITIES, ENGINE_NAME, ENGINE_VERSION, Session, read_request
from .validation import validate


def _resolve_inputs(request: dict) -> tuple[str, str]:
    """Returns the scenario path and the root the entrypoint is relative to."""
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


def run(request_path: str) -> int:
    request = read_request(request_path)
    session = Session(
        job_id=request["jobId"],
        attempt_id=request["attemptId"],
        engine_name=ENGINE_NAME,
        engine_version=ENGINE_VERSION,
    )
    session.hello(CAPABILITIES)

    operation = request.get("operation", "coverage")
    operations = {
        "coverage": ["outputCoverage"],
        "bounds": ["memoryBounds"],
        "conflicts": ["writeWriteConflict"],
        "full": None,
        "validate": None,
        "parse": [],
    }
    if operation not in operations:
        session.error(
            "INPUT_INVALID",
            f"operation {operation} is not offered by this engine revision",
            {"operation": operation},
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
        session.progress("extract", 0, 3, "parsing the entrypoint")
        entrypoint_relative = scenario["entrypoint"]["path"]
        # The entrypoint path is resolved inside the mapped root, never as a host
        # path taken from the scenario.
        entrypoint_path = os.path.normpath(
            os.path.join(files_root, entrypoint_relative)
        )
        if not entrypoint_path.startswith(os.path.normpath(files_root) + os.sep):
            raise InputInvalid("the scenario entrypoint escapes its mapped root")
        root = Path(files_root).resolve()
        path = root / entrypoint_relative
        if any(
            part.is_symlink()
            for part in [path, *path.parents]
            if part.is_relative_to(root)
        ) or not path.resolve().is_relative_to(root):
            raise InputInvalid(
                "the scenario entrypoint uses a symlink or escapes its mapped root"
            )
        entrypoint = select_entrypoint(
            path.read_text(encoding="utf-8"),
            entrypoint_relative,
            scenario["entrypoint"]["symbol"],
        )
        session.progress("extract", 1, 3, "building the access table")
        extraction = None
        try:
            extraction = extract(entrypoint)
        except Unsupported as error:
            answers = [
                CoverageAnswer(
                    "unsupported", "not invoked", reason=str(error), property_id=prop
                )
                for prop in scenario["requiredProperties"]
            ]
            result = build_analysis_result(
                request, scenario, None, answers, scenario["domain"]["domainId"]
            )
            validate(result, "evidence.schema.yaml#/$defs/analysisResult")
            session.result(result)
            return 0
        session.progress("solve", 2, 3, "discharging the coverage query")

        domain_id = scenario["domain"]["domainId"]
        properties = operations[operation]
        if properties is None:
            properties = scenario["requiredProperties"]
        deadline = time.monotonic() + int(request["budget"]["solverTimeMs"]) / 1000
        answers = []
        for prop in properties:
            remaining_ms = max(0, int((deadline - time.monotonic()) * 1000))
            answers.append(query(scenario, extraction, remaining_ms, prop))
        if operation == "parse":
            answers = [
                CoverageAnswer(
                    "unsupported",
                    "not invoked",
                    reason="Parse-only operation does not decide this property.",
                    property_id=prop,
                )
                for prop in scenario["requiredProperties"]
            ]
        result = build_analysis_result(
            request, scenario, extraction, answers, domain_id
        )
        validate(result, "evidence.schema.yaml#/$defs/analysisResult")
        session.result(result)
        return 0
    except Unsupported as unsupported:
        # An unsupported construct is a result about the kernel, not a crash: it
        # names the construct and its source range.
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
    args = parser.parse_args(argv)
    return run(args.request)


if __name__ == "__main__":
    raise SystemExit(main())
