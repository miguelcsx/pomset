"""Evaluate the existing implementation; a no-go is a valid research result.

Run from the repository root:
    uv run --directory engines/triton python -m feasibility.gate
This writes reports only, never a capability revision or a publication.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import time

import z3

from pomset_triton.coverage import MODEL_NAME, MODEL_REVISION, output_coverage
from pomset_triton.extract import extract
from pomset_triton.parse import select_entrypoint

from .cases import ROOT, cases
from .probe import probe
from .report import render

EPICS = [
    "FND",
    "ENG",
    "SEC",
    "TRI",
    "LOC",
    "HST",
    "WEB",
    "PRS",
    "CUDA",
    "OMP",
    "TRX",
    "REL",
]


def decide(rows: list[dict], comparisons: list[dict]) -> dict:
    failures = [row["caseId"] for row in rows if not row["matchesOracle"]]
    controls = [row for row in rows if row.get("expected") == "unsat"]
    misclassified_controls = [
        row["caseId"] for row in controls if not row["matchesOracle"]
    ]
    completed = [row for row in comparisons if row["status"] == "completed"]
    exercised_properties = {row.get("property") for row in rows if row["matchesOracle"]}
    source_linked = (
        bool(rows) and not failures and all(row.get("sourceRanges") for row in rows)
    )
    # There is no validated benefit evaluator yet. Merely completing a tool
    # invocation cannot establish a comparable benefit or pass this gate.
    conditions = {
        "sourceLinkedReproducibleOutcomes": source_linked
        and {"memoryBounds", "outputCoverage", "writeWriteConflict"}
        <= exercised_properties,
        "documentedIndependentBenefit": False,
        "correctControlsNotMisclassified": bool(controls)
        and not misclassified_controls,
    }
    return {
        "decision": "go" if all(conditions.values()) else "no-go",
        "conditions": conditions,
        "caseCount": len(rows),
        "mismatchCount": len(failures),
        "controlCount": len(controls),
        "misclassifiedControls": misclassified_controls,
        "mismatchedCases": failures,
        "completedIndependentComparisons": len(completed),
        "measuredBenefit": None,
        "blockedEpics": EPICS,
        "unblockConditions": [
            "Complete the licensed corpus, including a confirmed conflict/control pair.",
            "Pass sound width, constraint, mask, allocation and query conformance checks.",
            "Run independent tools at exact versions and demonstrate a comparable benefit.",
            "Complete strategy measurements and verify reproducible point sequences.",
        ],
    }


def evaluate() -> tuple[list[dict], dict, list[dict]]:
    environment = probe()
    rows = []
    for case in cases():
        started = time.perf_counter_ns()
        entry = select_entrypoint(case["source"], "kernels/transform.py", "transform")
        extraction = extract(entry)
        answer = output_coverage(case["scenario"], extraction, 30_000)
        row = {
            "caseId": case["caseId"],
            "property": "outputCoverage",
            "expected": case["expected"],
            "actual": answer.status,
            "matchesOracle": answer.status == case["expected"],
            "witness": answer.witness,
            "oracle": case["oracle"],
            "scenario": case["scenario"],
            "sourceSha256": hashlib.sha256(case["source"].encode()).hexdigest(),
            "source": case["source"],
            "sourceRanges": [access.source_range for access in extraction.stores],
            "model": MODEL_NAME,
            "modelRevision": MODEL_REVISION,
            "solverVersion": z3.get_version_string(),
            "elapsedNs": time.perf_counter_ns() - started,
            "solverBudgetMs": 30_000,
        }
        rows.append(row)
    comparisons = []
    components = {item["name"]: item for item in environment["components"]}
    for tool, component in (
        ("Triton interpreter", "triton"),
        ("TileLens", "tilelens"),
        ("TritonSan", "triton"),
        ("Compute Sanitizer racecheck", "compute-sanitizer"),
    ):
        installed = components[component]
        reason = installed.get(
            "reason", "Tool invocation and conformance not implemented."
        )
        if tool == "TritonSan":
            reason = "CPU backend/toolchain not installed; " + reason
        for case in rows:
            comparisons.append(
                {
                    "tool": tool,
                    "caseId": case["caseId"],
                    "status": "blocked",
                    "reason": reason,
                    "toolVersion": installed.get("version"),
                    "platform": environment["platform"],
                    "invocation": None,
                    "evidenceClass": None,
                    "unblockCondition": "Install a pinned compatible tool and execute this case and its control.",
                }
            )
    return rows, environment, comparisons


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(value, list):
        text = (
            "[\n"
            + ",\n".join(json.dumps(row, sort_keys=True) for row in value)
            + "\n]\n"
        )
    else:
        text = json.dumps(value, indent=2, sort_keys=True) + "\n"
    path.write_text(text)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out", type=Path, default=ROOT / "fixtures/kernels/feasibility/reports"
    )
    args = parser.parse_args()
    rows, environment, comparisons = evaluate()
    write_json(args.out / "probe.json", environment)
    write_json(args.out / "witnesses.json", rows)
    write_json(args.out / "compare.json", comparisons)
    record = decide(rows, comparisons)
    record["inputs"] = {
        name: "sha256:" + hashlib.sha256((args.out / name).read_bytes()).hexdigest()
        for name in ("probe.json", "witnesses.json", "compare.json")
    }
    record["limitations"] = [
        "This is an evaluation of the existing implementation, not completion of FEA-001 through FEA-005.",
        "The finite oracle is internal, not an independent comparison tool.",
        "Bounds/conflict and width regressions now run locally; the feasibility corpus still exercises only coverage and has no strategy comparison.",
        "Only a reconstructed coverage fixture/control exists; no confirmed conflict pair exists.",
        "Measured timings describe one CPU run, not GPU speed or comparative performance.",
    ]
    write_json(args.out / "gate-record.json", record)
    (args.out / "index.html").write_text(render(record, rows, environment))
    print(json.dumps(record, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
