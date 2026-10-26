"""Snapshot identity and manifest hashing.

Two rules, and nothing else:

1. one file's identity is SHA-256 over its **original bytes**;
2. the manifest's identity is SHA-256 over its RFC 8785 canonical serialization
   with the ``manifestHash`` member omitted.

The second rule is the one that is easy to get subtly wrong, because the RFC
fixes number formatting to ECMAScript's shortest round-trip form. That is why
this side uses a library rather than a hand-rolled encoder, and why a shared
fixture is the gate: agreement is measured, not assumed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

import rfc8785


def sha256_of(data: bytes | str) -> str:
    """The prefixed lowercase-hex content hash the contract uses."""
    raw = data.encode("utf-8") if isinstance(data, str) else data
    return f"sha256:{hashlib.sha256(raw).hexdigest()}"


def canonical(value: Any) -> str:
    """The RFC 8785 canonical serialization, as text."""
    return rfc8785.dumps(value).decode("utf-8")


def file_hash(original_bytes: bytes | str) -> str:
    """One file's identity: SHA-256 over its original bytes, no canonicalization."""
    return sha256_of(original_bytes)


def manifest_hash(manifest: dict[str, Any]) -> str:
    """The manifest hash, with the manifest's own hash member omitted.

    The member is removed rather than set to null: a null is part of the
    serialization and would change the hash.
    """
    without_hash = {
        key: value for key, value in manifest.items() if key != "manifestHash"
    }
    return sha256_of(rfc8785.dumps(without_hash))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fixtures", type=Path, required=True)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)

    inputs = json.loads((args.fixtures / "inputs.json").read_text(encoding="utf-8"))[
        "cases"
    ]
    manifests = json.loads(
        (args.fixtures / "manifests.json").read_text(encoding="utf-8")
    )["cases"]

    report = {
        "canonical": {case["name"]: canonical(case["value"]) for case in inputs},
        "hashes": {case["name"]: manifest_hash(case["manifest"]) for case in manifests},
    }

    if args.json:
        json.dump(report, sys.stdout, ensure_ascii=False, indent=2, sort_keys=True)
        sys.stdout.write("\n")
    else:
        for name, value in report["canonical"].items():
            print(f"canonical {name}: {value}")
        for name, value in report["hashes"].items():
            print(f"hash {name}: {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
