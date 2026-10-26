"""Research records cannot silently turn implementation defects into a go."""

import sys
import importlib
import hashlib
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

cases = importlib.import_module("feasibility.cases").cases
gate = importlib.import_module("feasibility.gate")
decide = gate.decide
evaluate = gate.evaluate


def test_oracle_finds_the_declared_output_holes():
    records = {case["caseId"]: case for case in cases()}
    assert records["floor-remainder"]["oracle"]["firstUnwrittenIndex"] == 1024
    assert records["ceil-control"]["expected"] == "unsat"
    assert records["different-mask"]["oracle"]["firstUnwrittenIndex"] == 256
    assert records["output-extent"]["oracle"]["firstUnwrittenIndex"] == 1024


def test_repaired_queries_match_every_adversarial_oracle():
    rows, environment, comparisons = evaluate()
    by_id = {row["caseId"]: row for row in rows}
    assert by_id["floor-remainder"]["matchesOracle"]
    assert by_id["ceil-control"]["matchesOracle"]
    assert all(row["matchesOracle"] for row in rows)
    assert environment["platform"]["os"]
    assert all(row["status"] == "blocked" for row in comparisons)
    assert decide(rows, comparisons)["decision"] == "no-go"


def test_passing_internal_cases_cannot_substitute_for_an_independent_benefit():
    record = decide([{"caseId": "control", "matchesOracle": True}], [])
    assert record["decision"] == "no-go"
    assert not record["conditions"]["documentedIndependentBenefit"]
    assert "WEB" in record["blockedEpics"]


def test_gate_artifacts_preserve_inputs_and_resolve_their_hashes(tmp_path, monkeypatch):
    monkeypatch.setattr(sys, "argv", ["gate", "--out", str(tmp_path)])
    assert gate.main() == 0
    record = json.loads((tmp_path / "gate-record.json").read_text())
    for name, digest in record["inputs"].items():
        assert (
            digest
            == "sha256:" + hashlib.sha256((tmp_path / name).read_bytes()).hexdigest()
        )
    rows = json.loads((tmp_path / "witnesses.json").read_text())
    assert len(rows) == record["caseCount"]
    assert sum(not row["matchesOracle"] for row in rows) == record["mismatchCount"]
    assert all(
        row["source"] and row["scenario"] and row["sourceRanges"] for row in rows
    )
    assert "Decision: no-go" in (tmp_path / "index.html").read_text()
