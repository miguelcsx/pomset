"""The ledger must cover definitions, not merely references to identifiers."""

from pathlib import Path
import runpy

ROOT = Path(__file__).resolve().parents[3]
AUDIT = runpy.run_path(str(ROOT / "scripts/audit-spec.py"))


def test_inventory_has_one_record_for_every_requirement_and_task():
    requirements, tasks = AUDIT["inventory"]()
    assert len(requirements) == len(AUDIT["sections"]("docs/srs", "REQ"))
    assert len(tasks) == len(AUDIT["sections"]("docs/delivery", "TASK"))
    assert requirements and tasks
    assert all(record["tasks"] for record in requirements)
    assert all(not record["acceptanceEvidence"] for record in requirements)
    assert all(record["status"] != "complete" for record in tasks)


def test_missing_task_references_are_refused(tmp_path):
    old_root = AUDIT["sections"].__globals__["ROOT"]
    try:
        AUDIT["sections"].__globals__["ROOT"] = tmp_path
        (tmp_path / "docs/srs").mkdir(parents=True)
        (tmp_path / "docs/delivery").mkdir(parents=True)
        (tmp_path / "docs/srs/example.md").write_text(
            "### REQ-ENG-001  A requirement\n**Implemented by.** `TASK-ENG-999`.\n"
        )
        import pytest

        with pytest.raises(ValueError, match="undefined tasks"):
            AUDIT["inventory"]()
    finally:
        AUDIT["sections"].__globals__["ROOT"] = old_root
