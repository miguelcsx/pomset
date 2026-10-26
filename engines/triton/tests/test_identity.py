"""Snapshot identity from the Python side.

The same fixture set the TypeScript implementation is held to: the canonical
forms documented in the RFC, the manifest hashes recorded from the other
implementation, and the guarantee that omitting the hash member is what makes
the hash well defined.
"""

from __future__ import annotations

import json
from pathlib import Path

from pomset_triton.identity.manifest import (
    canonical,
    file_hash,
    manifest_hash,
    sha256_of,
)

FIXTURES = (
    Path(__file__).resolve().parents[3] / "packages" / "contracts" / "fixtures" / "jcs"
)


def load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def test_documented_canonical_forms() -> None:
    for case in load("inputs.json")["cases"]:
        if "canonical" not in case:
            continue
        assert canonical(case["value"]) == case["canonical"], case["name"]


def test_manifest_hashes_match_the_recorded_expectation() -> None:
    for case in load("manifests.json")["cases"]:
        assert manifest_hash(case["manifest"]) == case["expectedHash"], case["name"]


def test_hash_member_is_omitted_not_nulled() -> None:
    case = load("manifests.json")["cases"][0]
    without = {
        key: value for key, value in case["manifest"].items() if key != "manifestHash"
    }
    assert manifest_hash(case["manifest"]) == manifest_hash(
        {**without, "manifestHash": None}
    )


def test_member_order_does_not_matter() -> None:
    case = load("manifests.json")["cases"][1]
    shuffled = dict(reversed(list(case["manifest"].items())))
    assert manifest_hash(shuffled) == case["expectedHash"]


def test_file_hash_is_over_original_bytes() -> None:
    assert file_hash(b"hello") == (
        "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    )
    assert sha256_of("hello") == file_hash("hello")
