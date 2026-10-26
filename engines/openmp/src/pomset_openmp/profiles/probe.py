"""The OpenMP toolchain probe.

Nothing is advertised until it has been measured. A version mentioned in a
reference implementation is a candidate, not a support claim, and a tool that
compiles is not a tool that runs — so the probe compiles *and* runs two owned
fixtures and reports what happened to each.

The instrumented fixture is not merely compiled; it carries a race we planted,
and instrumentation counts as available only when it reports that race. A
sanitizer that starts and says nothing has told us nothing, and one that cannot
start says so: on this platform a ThreadSanitizer binary dies before `main`, and
that is recorded as the reason rather than smoothed over.

No user source is compiled here. The fixtures are ours.
"""

from __future__ import annotations

import hashlib
import platform
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from pomset_contracts.engine_protocol import command, stage

# A correct reduction: it must compute the right sum and report its OpenMP level.
PLAIN_SOURCE = """#include <omp.h>
#include <stdio.h>
int main(void) {
  long total = 0;
  #pragma omp parallel for reduction(+ : total)
  for (int i = 0; i < 1024; ++i) total += i;
  printf("%d %ld\\n", _OPENMP, total);
  return total == (1024L * 1023L / 2) ? 0 : 1;
}
"""

# The same shape with the reduction removed: a race a working ThreadSanitizer
# must report. Counted as available only when it does.
RACY_SOURCE = """#include <omp.h>
#include <stdio.h>
int main(void) {
  long counter = 0;
  #pragma omp parallel for
  for (int i = 0; i < 100000; ++i) counter++;
  printf("%ld\\n", counter);
  return 0;
}
"""

TIMEOUT_SECONDS = 30.0


def _source_hash(source: str) -> str:
    return "sha256:" + hashlib.sha256(source.encode()).hexdigest()


def _build(directory: Path, name: str, source: str, extra: list[str]) -> dict:
    """Compiles one owned fixture, with whatever flags the stage needs."""
    path = directory / f"{name}.c"
    path.write_text(source, encoding="utf-8")
    binary = directory / name
    return command(
        ["clang", *extra, str(path), "-o", str(binary)], TIMEOUT_SECONDS
    )


def measure() -> dict:
    """Compiles and runs the owned fixtures, and reports what actually happened."""
    compiler = shutil.which("clang")
    record: dict = {
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "platform": {"os": platform.system().lower(), "arch": platform.machine()},
        "limitations": [
            "Owned fixtures only; no arbitrary-kernel correctness claim follows.",
            "Compilation is artifact evidence; a successful build establishes no behaviour.",
            "A run that matches its reference is an observation, never a proof.",
            "Instrumentation changes timing and therefore which interleavings were explored.",
        ],
        "checks": [],
    }
    checks = record["checks"]

    if compiler is None:
        record["compiler"] = None
        record["blocked"] = "no clang executable is installed"
        return record

    record["compiler"] = command(["clang", "--version"], TIMEOUT_SECONDS)

    with tempfile.TemporaryDirectory(prefix="pomset-openmp-probe-") as working:
        root = Path(working)
        record["checks"].append(
            _openmp_run(root, "openmp-plain", PLAIN_SOURCE, [], expect_race=False)
        )
        record["checks"].append(
            _openmp_run(root, "openmp-thread-sanitizer", RACY_SOURCE, ["-fsanitize=thread"], expect_race=True)
        )
    return record


def _openmp_run(
    root: Path, name: str, source: str, extra: list[str], expect_race: bool
) -> dict:
    """One fixture: build it, run it, and judge the instrumented one by its report."""
    build = _build(root, name, source, ["-fopenmp", "-g", "-O1", *extra])
    stages = [
        stage("compile", build, "artifact"),
    ]
    if build["exitCode"] != 0:
        return {
            "check": name,
            "sourceHash": _source_hash(source),
            "stages": stages,
            "status": "failed",
            "reason": _first_line(build["stderr"]) or "the compiler refused the fixture",
        }

    binary = root / name
    run = command([str(binary)], TIMEOUT_SECONDS)
    stages.append(stage("run", run, "observed"))
    reported = "WARNING: ThreadSanitizer" in run["stderr"]

    if run["exitCode"] is None:
        return {
            "check": name,
            "sourceHash": _source_hash(source),
            "stages": stages,
            "status": "unknown",
            "reason": run["reason"],
        }
    if expect_race:
        # Instrumentation is available only when it caught the race we planted.
        return {
            "check": name,
            "sourceHash": _source_hash(source),
            "stages": stages,
            "status": "passed" if reported else "failed",
            "raceReported": reported,
            "reason": None
            if reported
            else (
                f"the instrumented fixture exited {run['exitCode']} without reporting "
                "the race it was built to carry"
            ),
        }
    return {
        "check": name,
        "sourceHash": _source_hash(source),
        "stages": stages,
        "status": "passed" if run["exitCode"] == 0 else "failed",
        "stdout": run["stdout"].strip().splitlines()[:1],
    }


def _first_line(text: str) -> str:
    lines = [line for line in text.splitlines() if line.strip()]
    return lines[0].strip() if lines else ""


def capabilities(record: dict) -> dict[str, dict]:
    """What the measurement supports, and the reason for anything it does not.

    A capability is only `immediate` when the fixture that exercises it passed.
    Everything else names the blocker, because an unavailable capability that
    explains itself is the honest alternative to one that approximates.
    """
    plain = _check(record, "openmp-plain")
    instrumented = _check(record, "openmp-thread-sanitizer")
    compiler = record.get("compiler") or {}
    version = _first_line(compiler.get("stdout", "")) or "an unidentified clang"

    compilation = _stage_status(plain, "compile")
    numerical = _stage_status(plain, "run")
    instrumentation = _stage_status(instrumented, "run")

    return {
        "compilation": {
            "availability": "immediate" if compilation == "passed" else "unavailable",
            "reason": None
            if compilation == "passed"
            else f"{version} could not build the owned fixture: {_detail(plain, 'compile')}",
        },
        "numericalReference": {
            "availability": "immediate" if numerical == "passed" else "unavailable",
            "reason": None
            if numerical == "passed"
            else f"the owned fixture did not run to a correct result: {_detail(plain, 'run')}",
        },
        "instrumentedExecution": {
            "availability": "immediate" if instrumentation == "passed" else "unavailable",
            "reason": None
            if instrumentation == "passed"
            else f"ThreadSanitizer cannot run on this platform: {_detail(instrumented, 'run')}",
        },
    }


def _check(record: dict, name: str) -> dict | None:
    for item in record.get("checks", []):
        if item["check"] == name:
            return item
    return None


def _stage_status(check: dict | None, name: str) -> str:
    if check is None:
        return "unknown"
    for item in check.get("stages", []):
        if item["stage"] == name:
            return item["status"]
    return "unknown"


def _detail(check: dict | None, name: str) -> str:
    """What happened at one stage, in the words of the run rather than a summary."""
    if check is None:
        return "the fixture was never built"
    for item in check.get("stages", []):
        if item["stage"] != name:
            continue
        invocation = item["invocation"]
        reported = _first_line(invocation["stderr"])
        if reported:
            return reported
        code = invocation["exitCode"]
        if code is None:
            return "it was still running when its budget expired"
        if code < 0:
            # Killed by a signal: the process never got to speak for itself,
            # which is what a sanitizer that cannot start looks like from here.
            return f"the binary died on signal {-code} before it printed anything"
        return f"it exited {code} without saying anything"
    return "the fixture has no such stage"


def main(argv: list[str] | None = None) -> int:
    import argparse
    import json

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True)
    arguments = parser.parse_args(argv)
    record = measure()
    record["capabilities"] = capabilities(record)
    Path(arguments.output).write_text(
        json.dumps(record, indent=2) + "\n", encoding="utf-8"
    )
    for feature, item in record["capabilities"].items():
        print(f"{feature}: {item['availability']} {item['reason'] or ''}".rstrip())
    return 0 if "blocked" not in record else 1


if __name__ == "__main__":
    raise SystemExit(main())
