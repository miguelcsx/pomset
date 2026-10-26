"""Probe native compilation separately from device execution; run only owned fixtures.

Run: uv run python -m engines.native.probe --output <path>
No input supplied by a user is parsed, compiled or executed by this probe.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import shutil
import subprocess
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

TIMEOUT_SECONDS = 20
OPENMP_SOURCE = """#include <stdio.h>
int main(void) {
  long sum = 0;
  #pragma omp parallel for reduction(+:sum)
  for (int i = 0; i < 1024; ++i) sum += i;
  printf("%d %ld\\n", _OPENMP, sum);
  return sum == (1024L * 1023L / 2) ? 0 : 1;
}
"""
CUDA_SOURCE = """extern "C" __global__ void identity(float *output) {
  unsigned int i = blockIdx.x * blockDim.x + threadIdx.x;
  output[i] = (float)i;
}
"""


def command(argv: list[str]) -> dict:
    started = time.perf_counter_ns()
    try:
        run = subprocess.run(
            argv, capture_output=True, text=True, timeout=TIMEOUT_SECONDS
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
            "reason": "probe timeout; progress unknown",
        }


def stage(name: str, invocation: dict, evidence: str) -> dict:
    return {
        "stage": name,
        "status": "unknown"
        if invocation["exitCode"] is None
        else "passed"
        if invocation["exitCode"] == 0
        else "failed",
        "evidenceClass": evidence,
        "invocation": invocation,
    }


def evaluate() -> dict:
    record = {
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "platform": {"os": platform.system(), "arch": platform.machine()},
        "checks": [],
        "limitations": [
            "Owned fixture conformance only; no arbitrary-kernel correctness claim.",
            "Compilation is artifact evidence; successful compilation establishes no memory property.",
            "An OpenMP clean run is observed coverage, never race freedom.",
            "CUDA device execution and sanitizer/measurement checks are not executed by this probe.",
            "A tool invocation is not a product capability promotion.",
        ],
    }
    checks = record["checks"]
    with tempfile.TemporaryDirectory(prefix="pomset-native-") as directory:
        root = Path(directory)
        for backend, compiler_name, source, extension in (
            ("openmp", "clang", OPENMP_SOURCE, "c"),
            ("cuda", "nvcc", CUDA_SOURCE, "cu"),
        ):
            compiler = shutil.which(compiler_name)
            source_hash = "sha256:" + hashlib.sha256(source.encode()).hexdigest()
            item = {
                "backend": backend,
                "requiresGpu": False,
                "sourceHash": source_hash,
                "source": source,
                "compilerPath": compiler,
                "stages": [],
            }
            checks.append(item)
            if not compiler:
                item.update(
                    status="blocked", reason=f"{compiler_name} executable not installed"
                )
                continue
            item["versionProbe"] = command([compiler, "--version"])
            if item["versionProbe"]["exitCode"] != 0:
                item.update(status="blocked", reason="compiler identity probe failed")
                continue
            path = root / f"probe.{extension}"
            path.write_text(source)
            if backend == "openmp":
                parsed = command([compiler, "-fopenmp", "-fsyntax-only", str(path)])
                item["stages"].append(stage("frontend", parsed, "artifact"))
                executable = root / "probe-openmp"
                compiled = command(
                    [compiler, "-fopenmp", str(path), "-o", str(executable)]
                )
                item["stages"].append(stage("compile-and-link", compiled, "artifact"))
                if compiled["exitCode"] == 0:
                    executed = command([str(executable)])
                    observation = stage("owned-cpu-reference", executed, "observed")
                    try:
                        specification, value = map(int, executed["stdout"].split())
                        observation["openmpSpecification"] = specification
                        observation["actual"] = value
                        observation["expected"] = sum(range(1024))
                        if value != observation["expected"]:
                            observation["status"] = "failed"
                    except ValueError:
                        if executed["exitCode"] is not None:
                            observation.update(
                                status="failed",
                                reason="unrecognized owned probe output",
                            )
                    item["stages"].append(observation)
                item["status"] = (
                    "failed"
                    if any(s["status"] == "failed" for s in item["stages"])
                    else "unknown"
                    if any(s["status"] == "unknown" for s in item["stages"])
                    else "passed"
                )
                if compiled["exitCode"] != 0:
                    item["reason"] = (
                        "Frontend and runtime link results are separate; inspect compiler diagnostics."
                    )
            else:
                output = root / "probe.ptx"
                compiled = command([compiler, "--ptx", str(path), "-o", str(output)])
                observation = stage("device-code-compilation", compiled, "artifact")
                if compiled["exitCode"] == 0 and output.is_file():
                    observation["artifactHash"] = (
                        "sha256:" + hashlib.sha256(output.read_bytes()).hexdigest()
                    )
                    observation["artifactBytes"] = output.stat().st_size
                elif compiled["exitCode"] == 0:
                    observation.update(
                        status="failed", reason="compiler produced no PTX artifact"
                    )
                item["stages"].append(observation)
                item["status"] = observation["status"]
    return record


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    record = evaluate()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(record, indent=2) + "\n")
    print(
        json.dumps(
            [
                {
                    "backend": c["backend"],
                    "status": c["status"],
                    "stages": [
                        {"stage": s["stage"], "status": s["status"]}
                        for s in c["stages"]
                    ],
                }
                for c in record["checks"]
            ],
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
