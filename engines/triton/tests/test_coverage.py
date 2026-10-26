"""The Triton engine's first vertical slice.

The two flagship cases are the whole point of the slice: the floor-divided grid
must produce a counterexample naming the unwritten index, and its ceiling-divided
control must stay silent. A check that fires on both, or on neither, is not
evidence of anything.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from pomset_triton.analysis import build_analysis_result, enumerated_points
from pomset_triton.coverage import output_coverage
from pomset_triton.extract import extract
from pomset_triton.parse import InputInvalid, Unsupported, select_entrypoint

REPO = Path(__file__).resolve().parents[3]
KERNEL = REPO / "examples/transform-floor-grid/kernels/transform.py"
DEFECT = REPO / "examples/transform-floor-grid/scenario.json"
CONTROL = REPO / "examples/transform-floor-grid/scenario-ceil.json"


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def entrypoint():
    return select_entrypoint(
        KERNEL.read_text(encoding="utf-8"), str(KERNEL), "transform"
    )


def test_selects_exactly_the_named_entrypoint() -> None:
    assert entrypoint().symbol == "transform"


def test_refuses_a_symbol_the_module_does_not_declare() -> None:
    with pytest.raises(InputInvalid, match="no @triton.jit function named"):
        select_entrypoint(KERNEL.read_text(encoding="utf-8"), str(KERNEL), "other")


def test_refuses_a_construct_outside_the_subset() -> None:
    source = """
import triton
import triton.language as tl

@triton.jit
def transform(X, Y, N, BLOCK: tl.constexpr):
    for i in range(4):
        pass
"""
    with pytest.raises(Unsupported, match="for"):
        extract(select_entrypoint(source, "k.py", "transform"))


def test_extracts_the_address_and_mask_of_the_store() -> None:
    extraction = extract(entrypoint())
    store = extraction.stores[0]
    assert store.pointer == "Y"
    assert store.lane_expression == "tl.program_id(0) * BLOCK + tl.arange(0, BLOCK)"
    assert "< N" in store.mask_expression
    assert len(extraction.accesses) == 2  # Both the assigned load and store.
    # Nothing concrete is invented for display.
    assert store.source_range["startLine"] > 0


def test_enumerates_the_declared_domain() -> None:
    scenario = load(DEFECT)
    points = enumerated_points(scenario["domain"])
    # 4096 sizes x 3 block choices x 2 dtypes, each counted once.
    assert len(points) == 4096 * 3 * 2


def test_the_floor_divided_grid_leaves_an_output_index_unwritten() -> None:
    scenario = load(DEFECT)
    answer = output_coverage(scenario, extract(entrypoint()), 30_000)
    assert answer.status == "sat"
    assert answer.witness is not None
    index = answer.witness["index"]
    n = answer.witness["assignments"]["N"]
    block = answer.witness["assignments"]["BLOCK"]
    assert 0 <= index < n
    # The unwritten index sits past everything the launched blocks covered.
    assert index >= (n // block) * block


def test_the_ceiling_divided_control_is_silent() -> None:
    scenario = load(CONTROL)
    answer = output_coverage(scenario, extract(entrypoint()), 30_000)
    assert answer.status == "unsat"


SHIFTED = """
import triton
import triton.language as tl

@triton.jit
def transform(X, Y, N, BLOCK: tl.constexpr):
    pid = tl.program_id(0)
    offsets = pid * BLOCK + tl.arange(0, BLOCK)
    mask = offsets < N
    x = tl.load(X + offsets, mask=mask)
    tl.store(Y + offsets + 1, x * 2.0, mask=mask)
"""


def test_a_shifted_store_address_is_modelled_rather_than_refused() -> None:
    """A halo or a shifted write is ordinary kernel code, so it is modelled.

    ``Y + offsets + 1`` parses as ``(Y + offsets) + 1``: addition is
    left-associative, so the allocation is not the left operand of the outermost
    sum. Reading the left operand alone refused every such address.
    """
    store = extract(select_entrypoint(SHIFTED, "k.py", "transform")).stores[0]
    assert store.pointer == "Y"
    assert store.lane_expression == (
        "tl.program_id(0) * BLOCK + tl.arange(0, BLOCK) + 1"
    )


def test_the_constant_offset_may_sit_on_either_side_of_the_sum() -> None:
    same = SHIFTED.replace("Y + offsets + 1", "Y + 1 + offsets")
    assert (
        extract(select_entrypoint(same, "k.py", "transform")).stores[0].pointer == "Y"
    )
    # Both are analysed, not merely parsed. Under the ceiling-divided control the
    # only unwritten element is index 0, which the shift leaves behind.
    for source in (SHIFTED, same):
        answer = output_coverage(
            load(CONTROL),
            extract(select_entrypoint(source, "k.py", "transform")),
            30_000,
        )
        assert answer.status == "sat"
        assert answer.witness is not None
        assert answer.witness["index"] == 0


def test_the_result_obeys_the_closed_outcome_table() -> None:
    scenario = load(DEFECT)
    extraction = extract(entrypoint())
    answer = output_coverage(scenario, extraction, 30_000)
    request = {
        "jobId": "job_1",
        "attemptId": "att_1",
        "snapshotId": scenario["snapshotId"],
        "scenarioId": scenario["scenarioId"],
        "profileRevisionId": "prf_triton_local_cpu",
        "budget": {
            "solverTimeMs": 30_000,
            "engineWallTimeMs": 120_000,
            "memoryBytes": 2_147_483_648,
            "maxMessageBytes": 1_048_576,
            "maxOutputBytes": 16_777_216,
            "maxArtifactBytes": 268_435_456,
        },
    }
    result = build_analysis_result(
        request, scenario, extraction, answer, scenario["domain"]["domainId"]
    )
    property_result = result["propertyResults"][0]
    assert property_result["outcome"] == "violated"
    assert property_result["method"] == "symbolic"
    assert property_result["evidenceClass"] == "counterexample"
    # An established result would have to carry a model, a revision and a domain.
    assert property_result["assumptions"]["modelRevision"]
    assert property_result["assumptions"]["domainRef"]
    assert result["coverage"]["denominator"]["kind"] == "enumerated"


@pytest.mark.parametrize(
    "signature",
    [
        "X, /, Y, N, BLOCK",
        "X, Y, N, BLOCK=128",
        "X, Y, N, *rest",
        "X, Y, N, *, BLOCK",
        "X, Y, N, BLOCK: int",
    ],
)
def test_refuses_unmodeled_entrypoint_signature(signature):
    source = f"@triton.jit\ndef transform({signature}):\n    pass\n"
    with pytest.raises(Unsupported):
        select_entrypoint(source, "k.py", "transform")


@pytest.mark.parametrize(
    "decoration", ["@triton.jit(debug=True)", "@wrapper\n@triton.jit"]
)
def test_refuses_unmodeled_decorators(decoration):
    with pytest.raises(Unsupported, match="decorator"):
        select_entrypoint(
            f"{decoration}\ndef transform(X):\n    pass\n", "k.py", "transform"
        )


def test_plain_redefinition_does_not_preserve_a_jit_entrypoint():
    with pytest.raises(InputInvalid, match="more than once"):
        select_entrypoint(
            "@triton.jit\ndef transform(X):\n    pass\ndef transform(Y):\n    pass\n",
            "k.py",
            "transform",
        )
