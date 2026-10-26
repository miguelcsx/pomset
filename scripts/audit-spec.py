"""Inventory every requirement/task and its declared implementation targets.

Target existence is navigation evidence, never proof of completion. This script
does not infer compliance from filenames or test counts. Manual findings and
measured acceptance live in docs/evaluation/implementation-audit.md.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/evaluation/reports"
IGNORED = {
    "node_modules",
    "dist",
    ".venv",
    "__pycache__",
    ".pytest_cache",
    ".ruff_cache",
}


def sections(directory: str, prefix: str) -> dict:
    records = {}
    for path in sorted((ROOT / directory).glob("*.md")):
        text = path.read_text()
        pattern = rf"^### ({prefix}-[A-Z]+-\d{{3}})\s+(.+)$"
        headings = list(re.finditer(pattern, text, re.MULTILINE))
        for index, heading in enumerate(headings):
            if heading[1] in records:
                raise ValueError(f"duplicate definition: {heading[1]}")
            end = (
                headings[index + 1].start() if index + 1 < len(headings) else len(text)
            )
            body = text[heading.end() : end]
            records[heading[1]] = {
                "id": heading[1],
                "title": heading[2],
                "document": path.relative_to(ROOT).as_posix(),
                "line": text[: heading.start()].count("\n") + 1,
                "body": body,
            }
    return records


def inventory() -> tuple[list[dict], list[dict]]:
    tasks = sections("docs/delivery", "TASK")
    requirements = sections("docs/srs", "REQ")
    for task in tasks.values():
        owns = re.search(r"\*\*Owns\.\*\*(.*?)(?=\n\*\*|$)", task["body"], re.S)
        targets = re.findall(r"`([^`]+)`", owns[1]) if owns else []
        task["declaredTargets"] = targets
        task["existingTargets"] = [
            target for target in targets if (ROOT / target).exists()
        ]
        task["missingTargets"] = [
            target for target in targets if not (ROOT / target).exists()
        ]
        task["requirements"] = sorted(
            set(re.findall(r"REQ-[A-Z]+-\d{3}", task["body"]))
        )
        task["acceptanceEvidence"] = []
        task["status"] = "partial/unverified" if task["existingTargets"] else "missing"
        if task["id"].startswith("TASK-FEA-"):
            task["status"] = (
                "partial/unverified" if task["existingTargets"] else "missing"
            )
        task["deliveryBlocker"] = "M0 no-go; see feasibility gate-record.json"
        del task["body"]
    for requirement in requirements.values():
        body = requirement.pop("body")
        requirement["tasks"] = sorted(set(re.findall(r"TASK-[A-Z]+-\d{3}", body)))
        unknown = set(requirement["tasks"]) - tasks.keys()
        if unknown:
            raise ValueError(
                f"{requirement['id']} references undefined tasks: {unknown}"
            )
        requirement["acceptanceScenarios"] = sorted(set(re.findall(r"ACC-\d{3}", body)))
        requirement["acceptanceEvidence"] = []
        requirement["status"] = "not verified"
        requirement["candidateImplementation"] = sorted(
            {
                target
                for task in requirement["tasks"]
                for target in tasks[task]["existingTargets"]
            }
        )
        requirement["candidateTests"] = sorted(
            {
                test
                for target in requirement["candidateImplementation"]
                for test in tests_for(target)
            }
        )
    return list(requirements.values()), list(tasks.values())


def tests_for(target: str) -> list[str]:
    parts = Path(target).parts
    if len(parts) < 2 or parts[0] not in {"apps", "packages", "engines"}:
        return []
    scope = ROOT.joinpath(*parts[:2])
    return sorted(
        path.relative_to(ROOT).as_posix()
        for path in scope.rglob("*")
        if path.is_file()
        and not set(path.relative_to(ROOT).parts) & IGNORED
        and (
            path.name.endswith((".test.ts", ".test.tsx"))
            or path.name.startswith("test_")
            and path.suffix == ".py"
        )
    )


def write_report() -> None:
    requirements, tasks = inventory()
    OUT.mkdir(parents=True, exist_ok=True)
    # One record per line keeps the complete ledgers below the repository's
    # 500-line limit while remaining machine-readable and diffable.
    for name, records in (("requirements", requirements), ("tasks", tasks)):
        (OUT / f"{name}.jsonl").write_text(
            "".join(json.dumps(record, sort_keys=True) + "\n" for record in records)
        )
    lines = [
        "# Implementation target inventory",
        "",
        "Generated with `nix develop -c python3 scripts/audit-spec.py`.",
        "",
        "Existing targets are candidates for review, not acceptance evidence. No requirement is closed.",
        "",
        "| Task | Status | Existing / declared targets |",
        "|---|---|---|",
    ]
    for task in tasks:
        lines.append(
            f"| {task['id']} | {task['status']} | {len(task['existingTargets'])} / {len(task['declaredTargets'])} |"
        )
    lines += ["", "| Requirement | Status | Delivery tasks |", "|---|---|---|"]
    for requirement in requirements:
        lines.append(
            f"| {requirement['id']} | {requirement['status']} | {', '.join(requirement['tasks'])} |"
        )
    (OUT / "inventory.md").write_text("\n".join(lines) + "\n")
    source_records = []
    roots = [
        ROOT / name
        for name in (
            "docs",
            "apps",
            "packages",
            "engines",
            "scripts",
            "profiles",
            "fixtures",
        )
    ]
    for directory in roots:
        for path in sorted(directory.rglob("*")):
            if not path.is_file() or path.is_symlink():
                continue
            relative = path.relative_to(ROOT)
            if set(relative.parts) & IGNORED or path.suffix in {".pyc", ".tsbuildinfo"}:
                continue
            if path.is_relative_to(OUT) or "feasibility/reports" in relative.as_posix():
                continue
            data = path.read_bytes()
            source_records.append(
                {
                    "path": relative.as_posix(),
                    "sha256": hashlib.sha256(data).hexdigest(),
                    "bytes": len(data),
                    "lines": data.count(b"\n"),
                }
            )
    (OUT / "sources.jsonl").write_text(
        "".join(json.dumps(record, sort_keys=True) + "\n" for record in source_records)
    )
    print(
        f"Inventoried {len(requirements)} requirements, {len(tasks)} tasks and {len(source_records)} files; none closed."
    )


if __name__ == "__main__":
    write_report()
