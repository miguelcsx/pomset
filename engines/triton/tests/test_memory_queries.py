"""Behavioral regressions for addresses, masks, domains and finite-width math."""

from copy import deepcopy
import json
from pathlib import Path

import pytest

from pomset_triton.coverage import query
from pomset_triton.domain_points import enumerated_points
from pomset_triton.extract import extract
from pomset_triton.parse import InputInvalid, select_entrypoint
from pomset_triton.analysis import build_analysis_result
from pomset_triton.validation import validate

ROOT = Path(__file__).resolve().parents[3]
SOURCE = (ROOT / "examples/transform-floor-grid/kernels/transform.py").read_text()
SCENARIO = json.loads(
    (ROOT / "examples/transform-floor-grid/scenario-ceil.json").read_text()
)


def check(property_id, source=SOURCE, scenario=None):
    selected = select_entrypoint(source, "kernels/transform.py", "transform")
    return query(scenario or SCENARIO, extract(selected), 3000, property_id)


def fixed(n=1025, block=256):
    scenario = deepcopy(SCENARIO)
    scenario["domain"]["variables"][0].update(min=n, max=n)
    scenario["domain"]["variables"][1]["values"] = [block]
    return scenario


def test_control_has_in_bounds_accesses_and_no_distinct_writers():
    scenario = fixed()
    assert check("memoryBounds", scenario=scenario).status == "unsat"
    assert check("writeWriteConflict", scenario=scenario).status == "unsat"


def test_an_assigned_load_is_checked_for_bounds():
    source = SOURCE.replace("X + offsets", "X + offsets + 1")
    # Pointer + offset is represented explicitly, avoiding ambiguous nested pointer arithmetic.
    source = source.replace("X + offsets + 1", "X + (offsets + 1)")
    answer = check("memoryBounds", source, fixed(1024))
    assert answer.status == "sat"
    assert answer.witness["address"] == 1024
    assert answer.witness["accessIndices"] == [0]


def test_two_programs_writing_the_same_lanes_produce_two_distinct_actors():
    source = SOURCE.replace("pid * BLOCK + tl.arange(0, BLOCK)", "tl.arange(0, BLOCK)")
    answer = check("writeWriteConflict", source, fixed(512))
    assert answer.status == "sat"
    witness = answer.witness
    assert (witness["programA"], witness["laneA"]) != (
        witness["programB"],
        witness["laneB"],
    )


def test_multiple_masks_collectively_cover_the_output():
    source = SOURCE.replace(
        "mask = offsets < N", "mask = (offsets < N) & (offsets < BLOCK)"
    )
    source += "\n    tail_mask = (offsets < N) & (offsets >= BLOCK)\n    tl.store(Y + offsets, x, mask=tail_mask)\n"
    assert check("outputCoverage", source, fixed()).status == "unsat"


def test_complex_domain_constraint_is_not_discarded():
    scenario = fixed(1024)
    scenario["domain"]["variables"][0]["max"] = 1025
    scenario["launch"]["grid"][0]["op"] = "floorDivide"
    scenario["domain"]["constraints"].append(
        {
            "constraintId": "multiple",
            "lhs": {
                "op": "modulo",
                "operands": [
                    {"op": "parameter", "parameter": "N"},
                    {"op": "parameter", "parameter": "BLOCK"},
                ],
            },
            "relation": "eq",
            "rhs": {"op": "literal", "value": 0},
        }
    )
    assert check("outputCoverage", scenario=scenario).status == "unsat"
    assert {point["N"] for point in enumerated_points(scenario["domain"])} == {1024}


def test_empty_domain_is_invalid_instead_of_vacuously_established():
    scenario = fixed(1024)
    scenario["domain"]["constraints"].append(
        {
            "constraintId": "impossible",
            "lhs": {"op": "parameter", "parameter": "N"},
            "relation": "lt",
            "rhs": {"op": "literal", "value": 0},
        }
    )
    with pytest.raises(InputInvalid, match="empty or contradictory"):
        check("outputCoverage", scenario=scenario)


def test_wrapping_i32_address_is_not_widened_to_mathematical_integers():
    scenario = fixed(2, 2)
    source = SOURCE.replace(
        "pid * BLOCK + tl.arange(0, BLOCK)",
        "pid * BLOCK + tl.arange(0, BLOCK) + 2147483647",
    )
    answer = check("memoryBounds", source, scenario)
    assert answer.status == "sat"
    assert answer.witness["address"] == -(1 << 31)


def test_data_dependent_address_is_explicitly_unsupported():
    source = SOURCE.replace("Y + offsets", "Y + x")
    assert check("outputCoverage", source, fixed()).status == "unsupported"


def test_budget_exhaustion_is_unknown():
    extraction = extract(select_entrypoint(SOURCE, "kernels/transform.py", "transform"))
    assert query(fixed(), extraction, 0, "memoryBounds").status == "unknown"


def test_portable_result_passes_canonical_schema_and_has_no_fake_replay():
    scenario = fixed(1025)
    scenario["launch"]["grid"][0]["op"] = "floorDivide"
    extraction = extract(select_entrypoint(SOURCE, "kernels/transform.py", "transform"))
    answer = query(scenario, extraction, 3000, "outputCoverage")
    budget = {
        "solverTimeMs": 3000,
        "engineWallTimeMs": 120000,
        "memoryBytes": 2147483648,
        "maxMessageBytes": 1048576,
        "maxOutputBytes": 16777216,
        "maxArtifactBytes": 268435456,
    }
    result = build_analysis_result(
        {
            "jobId": "job_test",
            "attemptId": "att_test",
            "snapshotId": scenario["snapshotId"],
            "scenarioId": scenario["scenarioId"],
            "profileRevisionId": "prf_test",
            "budget": budget,
        },
        scenario,
        extraction,
        answer,
        scenario["domain"]["domainId"],
    )
    validate(result, "evidence.schema.yaml#/$defs/analysisResult")
    assert result["witnesses"][0]["replay"]["outcome"] == "blocked"
    assert result["witnesses"][0]["minimization"]["attempted"]
    assert not result["actors"][0].get("coordinates")
    assert result["findings"][0]["sourceRanges"][0]["path"] == "kernels/transform.py"


def test_enumeration_filters_constraints_and_removes_duplicates():
    scenario = fixed()
    scenario["domain"]["variables"][1]["values"] = [256, 256]
    scenario["domain"]["variables"][2]["values"] = ["fp16", "fp16"]
    assert len(enumerated_points(scenario["domain"])) == 1


def test_bare_return_stops_extraction_before_unreachable_store():
    source = SOURCE.replace(
        "    tl.store(Y + offsets", "    return\n    tl.store(Y + offsets"
    )
    selected = extract(select_entrypoint(source, "kernels/transform.py", "transform"))
    assert not selected.stores
    assert check("outputCoverage", source, fixed(128, 128)).status == "unsupported"


def test_stores_before_return_remain_and_later_conflicts_are_unreachable():
    source = (
        SOURCE + "\n    return\n    tl.store(Y + tl.arange(0, BLOCK), x, mask=mask)\n"
    )
    selected = extract(select_entrypoint(source, "kernels/transform.py", "transform"))
    assert len(selected.stores) == 1
    assert check("writeWriteConflict", source, fixed(512, 128)).status == "unsat"


@pytest.mark.parametrize(
    "name", ["program", "lane", "output_index", "program_a", "lane_b"]
)
def test_user_parameter_names_cannot_alias_solver_coordinates(name):
    import re

    scenario = json.loads(json.dumps(fixed(1025)).replace('"N"', json.dumps(name)))
    scenario["launch"]["grid"][0]["op"] = "floorDivide"
    source = re.sub(r"\bN\b", name, SOURCE)
    assert check("outputCoverage", source, scenario).status == "sat"
    source = source.replace("X + offsets", "X + (offsets + 1025)")
    assert check("memoryBounds", source, scenario).status == "sat"


def test_bounded_domain_needs_no_additional_constraint():
    scenario = fixed()
    scenario["domain"]["constraints"] = []
    assert check("outputCoverage", scenario=scenario).status == "unsat"


@pytest.mark.parametrize("keywords", ["mask=mask, mask=False", "mask=mask, other=0"])
def test_invalid_store_keywords_are_rejected(keywords):
    from pomset_triton.parse import Unsupported

    source = SOURCE.replace(
        "tl.store(Y + offsets, x * 2.0, mask=mask)",
        f"tl.store(Y + offsets, x * 2.0, {keywords})",
    )
    with pytest.raises(Unsupported, match="keyword arguments"):
        extract(select_entrypoint(source, "kernels/transform.py", "transform"))
