"""Probe installed tools without importing or executing a user kernel."""

from __future__ import annotations

import importlib
import importlib.metadata
import platform
import shutil
import subprocess
import sys


def probe() -> dict:
    components = []
    for module_name, distribution in (
        ("pomset_triton", "pomset-triton"),
        ("numpy", "numpy"),
        ("z3", "z3-solver"),
        ("triton", "triton"),
        ("torch", "torch"),
        ("tilelens", "tilelens"),
    ):
        record = {"name": module_name, "supportLevel": "untested"}
        try:
            module = importlib.import_module(module_name)
            record.update(
                version=importlib.metadata.version(distribution),
                availability="immediate",
            )
            if module_name == "torch":
                record["cudaAvailable"] = bool(module.cuda.is_available())
        except Exception as error:
            record.update(availability="unavailable", reason=str(error))
        components.append(record)
    sanitizer = shutil.which("compute-sanitizer")
    native = {"name": "compute-sanitizer", "availability": "unavailable"}
    if sanitizer:
        result = subprocess.run(
            [sanitizer, "--version"], capture_output=True, text=True, timeout=10
        )
        native.update(
            availability="immediate" if result.returncode == 0 else "unavailable",
            exitCode=result.returncode,
            versionOutput=result.stdout + result.stderr,
        )
    else:
        native["reason"] = "compute-sanitizer executable not installed"
    components.append(native)
    return {
        "python": sys.version,
        "platform": {"os": platform.system(), "arch": platform.machine()},
        "components": components,
        "imageDigest": None,
        "capabilityValidation": "No capability is validated by an import probe.",
    }
