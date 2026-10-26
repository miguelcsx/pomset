"""Check every canonical fixture, including contextual semantic refusals."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator, FormatChecker
from pomset_contracts.semantic import semantic_problems
from referencing import Registry, Resource

SCHEMA_DIR = Path(__file__).resolve().parents[2] / "schema"
REPO_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_EXAMPLES = REPO_ROOT / "docs" / "contracts" / "examples"


def load_registry() -> tuple[Registry, dict[str, dict]]:
    """Registers every schema by its ``$id`` and returns them by file name."""
    registry = Registry()
    by_name: dict[str, dict] = {}
    for path in sorted(SCHEMA_DIR.glob("*.schema.yaml")):
        schema = yaml.safe_load(path.read_text(encoding="utf-8"))
        registry = registry.with_resource(schema["$id"], Resource.from_contents(schema))
        by_name[path.name] = schema
    return registry, by_name


def validator_for(
    schemas: dict[str, dict], registry: Registry, target: str
) -> Draft202012Validator:
    """Builds a validator for ``file.schema.yaml#/$defs/name``."""
    file_name, _, pointer = target.partition("#")
    schema = schemas.get(file_name)
    if schema is None:
        raise SystemExit(f"unknown schema file {file_name}")
    ref = f"{schema['$id']}#{pointer}"
    return Draft202012Validator(
        {"$ref": ref}, registry=registry, format_checker=FormatChecker()
    )


def tuple_violations(document: object) -> list[str]:
    """The first illegal outcome/method/evidenceClass combination, if any.

    Applied to a bare ``propertyResult`` and to each ``propertyResults`` entry of
    an ``analysisResult``, so the closed table is checked where the schema's
    ``if``/``then`` conditions can only reach part of it.
    """
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from pomset_contracts.generated.tuples import is_allowed_tuple

    problems: list[str] = []
    candidates: list[dict] = []
    if isinstance(document, dict):
        if "propertyResults" in document and isinstance(
            document["propertyResults"], list
        ):
            candidates.extend(document["propertyResults"])
        elif "outcome" in document:
            candidates.append(document)
    for index, result in enumerate(candidates):
        if not isinstance(result, dict):
            continue
        outcome = result.get("outcome")
        method = result.get("method")
        evidence_class = result.get("evidenceClass")
        if None in (outcome, method, evidence_class):
            continue
        if not is_allowed_tuple(str(outcome), str(method), str(evidence_class)):
            problems.append(
                f"propertyResults[{index}]: {outcome} x {method} x {evidence_class} is not permitted"
            )
    return problems


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--examples", type=Path, default=DEFAULT_EXAMPLES)
    args = parser.parse_args(argv)

    examples = args.examples
    if not examples.is_absolute() and not examples.exists():
        # The documented command runs `uv run --directory packages/contracts`,
        # which moves the working directory, so a repository-relative path is
        # resolved against the repository root as well.
        examples = REPO_ROOT / examples

    manifest_path = examples / "manifest.json"
    if not manifest_path.exists():
        print(f"manifest not found at {manifest_path}", file=sys.stderr)
        return 2
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    registry, schemas = load_registry()
    failures: list[str] = []
    accepted = rejected = 0

    for entry in manifest.get("valid", []):
        path = examples / entry["file"]
        document = json.loads(path.read_text(encoding="utf-8"))
        errors = list(
            validator_for(schemas, registry, entry["schema"]).iter_errors(document)
        )
        errors.extend(semantic_problems(document))
        errors.extend(tuple_violations(document))
        if errors:
            failures.append(
                f"valid fixture {entry['file']} was rejected: {getattr(errors[0], 'message', errors[0])}"
            )
        else:
            accepted += 1

    for entry in manifest.get("invalid", []) + manifest.get("invalid_expected", []):
        name = entry["file"]
        path = examples / name
        document = json.loads(path.read_text(encoding="utf-8"))

        errors = list(
            validator_for(schemas, registry, entry["schema"]).iter_errors(document)
        )
        context = entry.get("contextScenario")
        scenario = (
            json.loads((examples / context).read_text(encoding="utf-8"))
            if context
            else None
        )
        errors.extend(semantic_problems(document, scenario))
        errors.extend(tuple_violations(document))
        if errors:
            rejected += 1
        else:
            failures.append(f"invalid fixture {name} was accepted by {entry['schema']}")

    print(
        f"fixtures: {accepted} accepted, {rejected} rejected, 0 deferred",
    )
    if failures:
        for line in failures:
            print(f"  FAIL {line}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
