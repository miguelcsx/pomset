"""Run a built kernel, and read back what it wrote.

Every run is a fresh process: thread counts, scheduling and anything the runtime
keeps between calls are part of what is being observed, not details of the
harness.

The thread count is swept rather than fixed. A defect that depends on how the
work was divided is invisible at most divisions, and a run that agreed at one
division is coverage of that division and nothing more. A run that does not
finish inside its budget is recorded as unknown progress: a clock cannot tell a
program that is blocked from one that is slow, and `REQ-EVD-010` forbids
reporting a timeout as a deadlock or as a liveness failure.
"""

from __future__ import annotations

import os
from pathlib import Path

from pomset_contracts.engine_protocol import command

from .buffers import parse_dump

# Chosen so that a defect depending on how work is divided has somewhere to show
# itself, without turning one scenario into an unbounded number of runs.
THREAD_COUNTS = (1, 2, 4, 8, 16)

RUN_TIMEOUT_SECONDS = 30.0


def run_once(
    binary: Path,
    arguments: list[int],
    threads: int,
    timeout_seconds: float = RUN_TIMEOUT_SECONDS,
) -> dict:
    """One execution at one thread count, with everything it printed."""
    environment = {
        **os.environ,
        "OMP_NUM_THREADS": str(threads),
        "OMP_DYNAMIC": "false",
    }
    result = command(
        [str(binary), *[str(argument) for argument in arguments]],
        timeout_seconds,
        environment,
    )
    return {
        "threads": threads,
        "exitCode": result["exitCode"],
        "elapsedNs": result["elapsedNs"],
        "stdout": result["stdout"],
        "stderr": result["stderr"],
        **({"reason": result["reason"]} if "reason" in result else {}),
    }


def sweep(
    binary: Path,
    arguments: list[int],
    thread_counts: tuple[int, ...] = THREAD_COUNTS,
) -> list[dict]:
    """The same build, run once per thread count."""
    return [run_once(binary, arguments, threads) for threads in thread_counts]


def observed_values(run: dict, dtype: str) -> list[float] | None:
    """What one run wrote, or ``None`` when it did not finish."""
    if run["exitCode"] is None:
        return None
    return parse_dump(dtype, run["stdout"])


def reported_threads(stdout: str) -> int | None:
    """The thread count the runtime actually used, when the driver says so."""
    for line in stdout.splitlines():
        if line.startswith("#threads"):
            try:
                return int(line.split()[1])
            except (IndexError, ValueError):
                return None
    return None
