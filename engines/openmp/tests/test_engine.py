"""The OpenMP engine's own checks.

Several of these are about what the engine must *not* say: a run that agreed is
never established, a poisoned element is not a wrong value, and an unavailable
sanitizer is named rather than passed over. Those are the claims that would be
easy to get wrong and hard to notice.
"""

from __future__ import annotations

import json
import struct
import subprocess
import sys
from pathlib import Path


from pomset_openmp.profiles.probe import capabilities, measure
from pomset_openmp.run import compile as compilation
from pomset_openmp.run.buffers import input_value, poison, poison_literal
from pomset_openmp.run.reference import compare

COMPLETE = """#include <omp.h>
void transform(float *X, float *Y, int N, int T) {
  #pragma omp parallel for num_threads(T)
  for (int i = 0; i < N; ++i) Y[i] = X[i] * 2.0f;
}
"""

PARTIAL = """#include <omp.h>
void transform(float *X, float *Y, int N, int T) {
  #pragma omp parallel for num_threads(T)
  for (int i = 0; i < N; ++i) if (i % 2 == 0) Y[i] = X[i] * 2.0f;
}
"""


def scenario(name: str, size: int = 64) -> dict:
    return {
        "schemaVersion": 1,
        "scenarioId": f"scn_{name}",
        "snapshotId": f"snp_{name}",
        "name": name,
        "entrypoint": {"path": "kernel.c", "symbol": "transform"},
        "allocations": [
            {
                "allocationId": "al_x",
                "name": "X",
                "role": "input",
                "dtype": "fp32",
                "shape": [{"op": "parameter", "parameter": "N"}],
            },
            {
                "allocationId": "al_y",
                "name": "Y",
                "role": "output",
                "dtype": "fp32",
                "shape": [{"op": "parameter", "parameter": "N"}],
            },
        ],
        "launch": {"threads": {"op": "parameter", "parameter": "T"}},
        "domain": {
            "domainId": f"dom_{name}",
            "enumerable": True,
            "variables": [
                {
                    "name": "N",
                    "kind": "shape",
                    "type": "int",
                    "width": "i32",
                    "min": size,
                    "max": size,
                    "step": 1,
                },
                {
                    "name": "T",
                    "kind": "launch",
                    "type": "int",
                    "width": "i32",
                    "min": 2,
                    "max": 2,
                    "step": 1,
                },
            ],
            "constraints": [],
        },
        "reference": {
            "kind": "host-python",
            "path": "reference.py",
            "symbol": "reference",
            "tolerances": {
                "atol": 0.001,
                "rtol": 0.00001,
                "dtype": "fp32",
                "nanPolicy": "reject-nan",
                "infPolicy": "reject-inf",
            },
        },
        "requiredProperties": ["numericalAgreement", "initialization"],
        "notes": "",
        "createdAt": "2026-10-18T00:00:00Z",
    }


def request(declaration: dict, *, consented: bool = True) -> dict:
    return {
        "schemaVersion": 1,
        "protocolVersion": 1,
        "jobId": "job_test",
        "attemptId": "att_test",
        "operation": "full",
        "snapshotId": declaration["snapshotId"],
        "scenarioId": declaration["scenarioId"],
        "profileRevisionId": "prf_test",
        "domainRef": declaration["domain"]["domainId"],
        "budget": {
            "solverTimeMs": 30000,
            "engineWallTimeMs": 60000,
            "memoryBytes": 1073741824,
            "maxMessageBytes": 1048576,
            "maxOutputBytes": 16777216,
            "maxArtifactBytes": 268435456,
        },
        "inputs": [
            {"kind": "scenario", "path": "scenario.json"},
            {"kind": "files", "path": "files"},
        ],
        "scratchDir": "scratch",
        **(
            {"consent": {"granted": True, "scope": "numerical-replay"}}
            if consented
            else {}
        ),
    }


def stage(
    tmp_path: Path, name: str, kernel: str, reference: str, *, consented: bool = True
):
    """Writes one captured snapshot and returns the engine's terminal record."""
    (tmp_path / "files").mkdir(exist_ok=True)
    (tmp_path / "files" / "kernel.c").write_text(kernel, encoding="utf-8")
    (tmp_path / "files" / "reference.py").write_text(reference, encoding="utf-8")
    declaration = scenario(name)
    (tmp_path / "scenario.json").write_text(json.dumps(declaration), encoding="utf-8")
    (tmp_path / "request.json").write_text(
        json.dumps(request(declaration, consented=consented)), encoding="utf-8"
    )
    finished = subprocess.run(
        [sys.executable, "-m", "pomset_openmp", "--request", "request.json"],
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )
    records = [
        json.loads(line) for line in finished.stdout.splitlines() if line.strip()
    ]
    terminal = [record for record in records if record["type"] in {"result", "error"}]
    assert terminal, finished.stderr[-800:]
    return terminal[-1], finished.returncode


def test_the_poison_is_the_value_the_declared_width_holds() -> None:
    """Comparing across widths would mistake "never written" for "written oddly"."""
    assert poison("fp32") == struct.unpack("f", struct.pack("f", -1.0e30))[0]
    assert poison("fp32") != -1.0e30
    assert poison("fp64") == -1.0e30
    assert poison_literal("fp32").endswith("f")


def test_an_unwritten_element_is_not_reported_as_a_wrong_value() -> None:
    tolerances = {"atol": 0.0, "rtol": 0.0, "nanPolicy": "reject-nan"}
    verdict = compare(
        [1.0, poison("fp32"), 3.0], [1.0, 2.0, 3.0], tolerances, poison("fp32")
    )
    assert verdict["verdict"] == "unwritten"
    assert verdict["first"] == 1
    assert verdict["count"] == 1


def test_a_float_sum_is_compared_under_declared_tolerances() -> None:
    """Exact equality would call every parallel reduction a defect."""
    exact = {"atol": 0.0, "rtol": 0.0, "nanPolicy": "reject-nan"}
    tolerant = {"atol": 1e-3, "rtol": 0.0, "nanPolicy": "reject-nan"}
    observed, expected = [1.0000001], [1.0]
    assert compare(observed, expected, exact, 0.0)["verdict"] == "differs"
    assert compare(observed, expected, tolerant, 0.0)["verdict"] == "agrees"


def test_the_input_pattern_is_exact_in_the_width_it_is_written() -> None:
    for index in range(64):
        assert float(input_value("fp32", index)) == input_value("fp32", index)
    assert "17" in compilation.driver_source(
        "transform",
        [{"name": "X", "dtype": "fp32", "role": "input"}],
        [{"name": "N", "type": "int", "width": "i32"}],
        {"X": 4},
        {"N": 4},
    )


def test_refuses_to_run_without_consent(tmp_path: Path) -> None:
    terminal, _ = stage(
        tmp_path,
        "noconsent",
        COMPLETE,
        "def reference(x):\n    return [value * 2.0 for value in x]\n",
        consented=False,
    )
    assert terminal["type"] == "error"
    assert terminal["payload"]["code"] == "INPUT_INVALID"
    assert "--trust-local-code" in terminal["payload"]["message"]


def test_a_correct_kernel_is_never_established(tmp_path: Path) -> None:
    """`established` is reachable only through reasoning, never through a run."""
    terminal, code = stage(
        tmp_path,
        "complete",
        COMPLETE,
        "def reference(x):\n    return [value * 2.0 for value in x]\n",
    )
    assert code == 0, terminal
    assert terminal["type"] == "result"
    properties = terminal["payload"]["propertyResults"]
    outcomes = {item["propertyId"]: item["outcome"] for item in properties}
    assert outcomes["numericalAgreement"] == "unknown"
    assert outcomes["initialization"] == "unknown"
    for item in properties:
        assert item["outcome"] != "established"
        assert item["evidenceClass"] == "potential"
        assert item["unknownReason"]


def test_an_element_no_store_reached_is_an_initialization_violation(
    tmp_path: Path,
) -> None:
    terminal, code = stage(
        tmp_path,
        "partial",
        PARTIAL,
        "def reference(x):\n    return [value * 2.0 for value in x]\n",
    )
    assert code == 0, terminal
    properties = terminal["payload"]["propertyResults"]
    initialization = next(
        item for item in properties if item["propertyId"] == "initialization"
    )
    assert initialization["outcome"] == "violated"
    assert initialization["evidenceClass"] == "observed"
    assert "poison" in terminal["payload"]["coverage"]["notes"]


def test_a_kernel_the_compiler_refuses_decides_nothing(tmp_path: Path) -> None:
    terminal, code = stage(
        tmp_path,
        "broken",
        "#include <omp.h>\nvoid transform(float *X, float *Y, int N, int T) { Y[0] = X[0] }\n",
        "def reference(x):\n    return [value * 2.0 for value in x]\n",
    )
    assert code == 0, terminal
    for item in terminal["payload"]["propertyResults"]:
        assert item["outcome"] == "unsupported"
        assert "expected ';'" in item["unsupportedReason"]


def test_the_probe_names_why_instrumentation_is_unavailable() -> None:
    """A tool that is installed is not a tool that works, so the reason is measured."""
    measured = capabilities(measure())
    entry = measured["instrumentedExecution"]
    if entry["availability"] == "unavailable":
        assert entry["reason"], "an unavailable capability must say why"
    else:
        assert entry["reason"] is None


def test_the_engine_offers_only_operations_that_execute() -> None:
    from pomset_openmp.__main__ import OPERATIONS

    assert OPERATIONS == {"full", "validate"}
    assert all(isinstance(name, str) for name in OPERATIONS)
