"""What the OpenMP engine concludes, and how it says so.

The engine executes a kernel and compares what came out against the scenario's
own reference. What it may then say is narrowly bounded by the contract, and the
bounds are the interesting part:

- A run that agreed is **coverage of that run**. `established` is reachable only
  through static or symbolic reasoning over a stated model
  (`REQ-EVD-003`), so agreement under observation is reported as `unknown` with
  the reason printed beside it. "No failures observed" is never a proof.
- A run that disagreed is `violated` with method `instrumented` and evidence
  class `observed` — the one row of the closed table an executed check may use.
- A run that did not finish is unknown progress, never a deadlock.
- A property this backend does not model, or cannot instrument on this machine,
  is `unsupported` with the capability and the measured reason named.

What was executed is recorded as a `sampledCheck`, one observation per declared
domain point. That is the contract's own home for "this is what we ran", and it
is why the region below is classified `sampled` rather than given a verdict it
has not earned.

A violation carries no finding and no witness, because both require a source
range and this harness has no source map for a C kernel: it can say which
*element* disagreed, not which line. The element and the values are named in the
coverage notes; claiming a line would be inventing precision.
"""

from __future__ import annotations

import tempfile
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from pomset_contracts.domain_points import enumerated_points, evaluate, widths_of
from pomset_contracts.engine_protocol import InputInvalid

from .profiles.probe import capabilities as probe_capabilities
from .profiles.probe import measure as probe_measure
from .run import compile as compilation
from .run import launch, reference
from .run.buffers import TYPES, input_value, poison

MODEL_NAME = "openmp-host-execution"
MODEL_REVISION = "1"

# How many of the declared domain points are executed. A domain can enumerate to
# thousands; the count actually exercised is part of the evidence rather than an
# implementation detail, and is stated in the coverage.
MAX_EXECUTED_POINTS = 8

# What this backend decides, and what it can only refuse.
MODELLED = ("numericalAgreement", "initialization")
INSTRUMENTED = ("raceFreedom", "synchronizationOrdering", "deadlockFreedom")

_MEASURED: dict | None = None


def instrumentation_reason() -> str:
    """Why instrumented execution is unavailable, measured once per process.

    The probe compiles and runs its own fixtures rather than reporting a version:
    a tool that is installed is not a tool that works here.
    """
    global _MEASURED
    if _MEASURED is None:
        _MEASURED = probe_capabilities(probe_measure())
    entry = _MEASURED.get("instrumentedExecution", {})
    return entry.get("reason") or "instrumentation is available"


def analyse(request: dict, scenario: dict, files_root: Path, session) -> dict:
    """Runs the scenario's kernel and assembles the portable result."""
    domain_id = scenario["domain"]["domainId"]
    points = enumerated_points(scenario["domain"])
    allocations = scenario["allocations"]
    variables = scenario["domain"]["variables"]
    coverage_id = f"cov_{uuid4()}"
    sampled_check_id = f"smc_{uuid4()}"

    refusal = _refusal(scenario, allocations, variables)
    reference_function, reference_reason = (None, None)
    observations: list[dict] = []

    if refusal is None and points:
        reference_function, reference_reason = reference.load(scenario, files_root)
        if reference_function is not None:
            session.progress("compile", 0, 1, "building the kernel and its driver")
            observations = _execute(
                request,
                scenario,
                files_root,
                allocations,
                variables,
                points[:MAX_EXECUTED_POINTS],
                reference_function,
                session,
            )
            if observations and observations[0].get("buildError"):
                refusal = (
                    "the compiler refused this kernel, so nothing was executed: "
                    + observations[0]["buildError"]
                )
                observations = []
    elif refusal is None:
        refusal = (
            "the declared domain does not enumerate to any point this harness can run"
        )

    built = _properties(
        scenario,
        observations,
        refusal,
        reference_reason,
        coverage_id,
        sampled_check_id,
        domain_id,
    )
    notes = _coverage_notes(points, observations, built["details"])

    return {
        "schemaVersion": 1,
        "resultId": f"res_{uuid4()}",
        "jobId": request["jobId"],
        "attemptId": request["attemptId"],
        "snapshotId": request["snapshotId"],
        "scenarioId": request["scenarioId"],
        "profileRevisionId": request["profileRevisionId"],
        "domain": {"domainId": domain_id},
        "policyId": request.get("policyId", "pol_default"),
        "policyRevision": request.get("policyRevision", 1),
        "origin": "local",
        "executedAt": "local",
        "method": "instrumented",
        "propertyResults": built["properties"],
        "coverage": {
            "coverageId": coverage_id,
            "domainRef": domain_id,
            "denominator": _denominator(points),
            "regions": [
                {
                    "regionId": f"rgn_{uuid4()}",
                    "label": "the declared domain, as executed",
                    "constraints": [
                        "; ".join(
                            f"{variable['name']}:{variable.get('width', 'i32')}"
                            for variable in variables
                        )
                    ],
                    "classifications": [
                        {
                            "propertyId": item["propertyId"],
                            "classification": (
                                "sampled"
                                if item["outcome"] == "unknown"
                                else item["outcome"]
                            ),
                            "method": item["method"],
                            **(
                                {"sampledCheckId": sampled_check_id}
                                if item["outcome"] == "unknown"
                                else {}
                            ),
                        }
                        for item in built["properties"]
                    ],
                }
            ],
            "notes": notes[:2000],
        },
        "sampledChecks": [_sampled_check(sampled_check_id, request, observations)],
        "budget": request["budget"],
        "queryRevision": MODEL_REVISION,
        "completeness": _completeness(points, observations),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }


def _refusal(scenario, allocations, variables) -> str | None:
    """What makes this scenario unrunnable, named before anything is built."""
    if not scenario.get("entrypoint", {}).get("symbol"):
        return "the scenario declares no entrypoint symbol"
    if not any(item["role"] == "output" for item in allocations):
        return (
            "the scenario declares no output allocation, so there is nothing to compare"
        )
    for allocation in allocations:
        if len(allocation["shape"]) != 1:
            return (
                f"allocation {allocation['name']} has {len(allocation['shape'])} axes; "
                "this backend drives one-dimensional allocations"
            )
        if allocation["dtype"] not in TYPES:
            return (
                f"allocation {allocation['name']} has dtype {allocation['dtype']}, "
                "which this harness cannot read back at its own width"
            )
    for variable in variables:
        if variable.get("type") != "int":
            return (
                f"domain variable {variable['name']} is {variable.get('type')}, "
                "and a non-numeric variable cannot be passed to a C kernel"
            )
    return None


def _execute(
    request,
    scenario,
    files_root,
    allocations,
    variables,
    points,
    reference_function,
    session,
) -> list[dict]:
    """Runs every selected domain point, at every thread count."""
    widths = widths_of(scenario["domain"])
    source = (files_root / scenario["entrypoint"]["path"]).resolve()
    if not source.is_relative_to(files_root.resolve()) or not source.is_file():
        raise InputInvalid("the entrypoint is not among the captured files")

    observations: list[dict] = []
    with tempfile.TemporaryDirectory(prefix="pomset-openmp-") as working:
        root = Path(working)
        for index, point in enumerate(points):
            extents = {
                item["name"]: evaluate(item["shape"][0], point, widths)[0]
                for item in allocations
            }
            if any(extent <= 0 for extent in extents.values()):
                return [{"buildError": f"a declared extent is not positive at {point}"}]
            if sum(extents.values()) > 1 << 22:
                return [
                    {
                        "buildError": "the declared extents exceed what this harness will allocate"
                    }
                ]

            values = {item["name"]: point[item["name"]] for item in variables}
            driver = compilation.driver_source(
                scenario["entrypoint"]["symbol"],
                allocations,
                variables,
                extents,
                values,
            )
            built, binary = compilation.build(root / f"point{index}", [source], driver)
            if built["exitCode"] != 0:
                return [{"buildError": _first_line(built["stderr"])}]

            session.progress(
                "instrument",
                index + 1,
                min(len(points), MAX_EXECUTED_POINTS),
                f"{scenario['entrypoint']['symbol']} at {_point_statement(values)}",
            )
            runs = launch.sweep(binary, [])
            expected = _expected(
                reference_function, scenario, allocations, point, extents
            )
            observations.append(
                {
                    "point": dict(point),
                    "extents": extents,
                    "runs": runs,
                    "verdicts": _verdicts(
                        runs, allocations, extents, expected, scenario
                    ),
                }
            )
    return observations


def _first_line(text: str) -> str:
    lines = [line for line in text.splitlines() if line.strip()]
    return lines[0].strip() if lines else "the compiler gave no diagnostic"


def _point_statement(values: dict) -> str:
    return ", ".join(f"{name}={value}" for name, value in sorted(values.items()))


def _expected(function, scenario, allocations, point, extents) -> dict | None:
    """What the reference says the outputs should be, for one domain point."""
    if function is None:
        return None
    kind = scenario.get("reference", {}).get("kind")
    inputs = []
    for item in allocations:
        if item["role"] != "input":
            continue
        values = [
            input_value(item["dtype"], index) for index in range(extents[item["name"]])
        ]
        inputs.append(_as_array(kind, item["dtype"], values))
    produced = function(*inputs)
    outputs = [item for item in allocations if item["role"] == "output"]
    if len(outputs) == 1:
        produced = [produced]
    if not isinstance(produced, (list, tuple)) or len(produced) != len(outputs):
        return None
    return {
        item["name"]: [float(value) for value in produced[index]]
        for index, item in enumerate(outputs)
    }


def _as_array(kind: str | None, dtype: str, values: list) -> object:
    """The declared reference's own view of an input.

    A `numpy` reference is handed arrays; a `host-python` one is handed plain
    lists, because that is what plain Python means. A `numpy` reference on a
    machine without numpy is a missing capability, named, not a crash.
    """
    if kind == "numpy":
        try:
            import numpy
        except ImportError as error:  # pragma: no cover - depends on the deployment
            raise InputInvalid(
                "this scenario declares a numpy reference and numpy is not installed"
            ) from error

        return numpy.array(
            values, dtype="float64" if TYPES[dtype]["kind"] == "float" else "int64"
        )
    return values


def _verdicts(runs, allocations, extents, expected, scenario) -> list[dict]:
    """One verdict per run, for every output allocation, in declaration order."""
    outputs = [item for item in allocations if item["role"] == "output"]
    tolerances = scenario.get("reference", {}).get("tolerances", {})
    verdicts = []
    for run in runs:
        if run["exitCode"] is None:
            verdicts.append(
                {
                    "threads": run["threads"],
                    "verdict": "unfinished",
                    "reason": run.get("reason", ""),
                }
            )
            continue
        if run["exitCode"] != 0:
            verdicts.append(
                {
                    "threads": run["threads"],
                    "verdict": "crashed",
                    "reason": f"exit {run['exitCode']}",
                }
            )
            continue
        written = launch.observed_values(run, outputs[0]["dtype"])
        if expected is None or written is None:
            verdicts.append({"threads": run["threads"], "verdict": "executed"})
            continue
        offset = 0
        combined: dict = {"verdict": "agrees"}
        for item in outputs:
            size = extents[item["name"]]
            chunk = written[offset : offset + size]
            offset += size
            verdict = reference.compare(
                chunk, expected[item["name"]], tolerances, float(poison(item["dtype"]))
            )
            if verdict["verdict"] != "agrees":
                combined = dict(verdict)
                break
        verdicts.append({"threads": run["threads"], **combined})
    return verdicts


def _properties(
    scenario,
    observations,
    refusal,
    reference_reason,
    coverage_id,
    sampled_check_id,
    domain_id,
):
    """The closed set of outcomes this backend may report, and why."""
    assumptions = _assumptions(domain_id)
    properties = []
    details: list[str] = []
    for property_id in scenario["requiredProperties"]:
        item, detail = _property(
            property_id,
            observations,
            refusal,
            reference_reason,
            assumptions,
            coverage_id,
            sampled_check_id,
        )
        properties.append(item)
        if detail:
            details.append(detail)
    return {"properties": properties, "details": details}


def _property(
    property_id,
    observations,
    refusal,
    reference_reason,
    assumptions,
    coverage_id,
    sampled_check_id,
):
    base = {
        "propertyResultId": f"pru_{uuid4()}",
        "propertyId": property_id,
        "method": "instrumented",
        "evidenceClass": "potential",
        "assumptions": assumptions,
        "coverageRef": coverage_id,
        "sampledCheckIds": [sampled_check_id],
    }

    if property_id in INSTRUMENTED:
        return {
            **base,
            "outcome": "unsupported",
            "unsupportedReason": (
                f"instrumentedExecution is unavailable: {instrumentation_reason()}. A clean run "
                "would be coverage of that run and never a statement about race freedom, so "
                "nothing is claimed either way."
            ),
        }, ""
    if property_id not in MODELLED:
        return {
            **base,
            "outcome": "unsupported",
            "unsupportedReason": (
                f"the {MODEL_NAME} model does not decide {property_id}; "
                f"it decides {' and '.join(MODELLED)}"
            ),
        }, ""
    if refusal is not None:
        return {**base, "outcome": "unsupported", "unsupportedReason": refusal}, ""
    if reference_reason is not None:
        return {
            **base,
            "outcome": "unsupported",
            "unsupportedReason": reference_reason,
        }, ""
    if not observations:
        return {
            **base,
            "outcome": "unsupported",
            "unsupportedReason": "no declared domain point was executed",
        }, ""

    verdicts = [verdict for item in observations for verdict in item["verdicts"]]
    threads = sorted({verdict["threads"] for verdict in verdicts})

    if property_id == "initialization":
        unwritten = [
            verdict for verdict in verdicts if verdict["verdict"] == "unwritten"
        ]
        if unwritten:
            first = unwritten[0]
            detail = (
                f"initialization: at {first['threads']} threads, {first['count']} output "
                "element(s) still held the poison the harness wrote, so no store reached them."
            )
            return {
                **base,
                "outcome": "violated",
                "evidenceClass": "observed",
                "semanticRole": "violation",
            }, detail
    if property_id == "numericalAgreement":
        wrong = [v for v in verdicts if v["verdict"] in {"differs", "mismatched"}]
        if wrong:
            first = wrong[0]
            detail = (
                f"numericalAgreement: at {first['threads']} threads, "
                f"{first.get('count', 1)} element(s) disagreed with the declared reference. "
                f"The first was element {first.get('first')}, which held "
                f"{first.get('observed')!r} where the reference gives {first.get('expected')!r}."
            )
            return {
                **base,
                "outcome": "violated",
                "evidenceClass": "observed",
                "semanticRole": "violation",
            }, detail

    unfinished = [verdict for verdict in verdicts if verdict["verdict"] == "unfinished"]
    if unfinished:
        return {
            **base,
            "outcome": "unknown",
            "unknownReason": (
                f"a run at {unfinished[0]['threads']} threads did not finish inside its budget. "
                "That is unknown progress: a clock cannot tell a program that is blocked from "
                "one that is slow, so it is neither a deadlock nor a pass."
            ),
        }, ""

    executed = [verdict for verdict in verdicts if verdict["verdict"] != "crashed"]
    if property_id == "initialization":
        # The property is whether every output element was written, so the reason
        # has to be about writing, not about agreeing with the reference.
        return {
            **base,
            "outcome": "unknown",
            "unknownReason": (
                f"every one of the {len(executed)} executions wrote all of its output elements — "
                f"none still held the poison — at thread counts {threads}. That is coverage of "
                "those runs, not a proof that no element stays unwritten under another division "
                "of the work."
            ),
        }, ""
    return {
        **base,
        "outcome": "unknown",
        "unknownReason": (
            f"every one of the {len(executed)} executions agreed with the declared reference at "
            f"thread counts {threads}. Agreement under observation is coverage of those runs and "
            "not a proof, and ThreadSanitizer was not run, so nothing is claimed about race freedom."
        ),
    }, ""


def _assumptions(domain_id: str) -> dict:
    """The stated envelope of what an observed run can mean."""
    return {
        "model": MODEL_NAME,
        "modelRevision": MODEL_REVISION,
        "domainRef": domain_id,
        "items": [
            {
                "assumptionId": "harness-inputs",
                "statement": (
                    "Input buffers hold the harness's own deterministic pattern, not the user's "
                    "data. A defect that needs different data is not exercised."
                ),
            },
            {
                "assumptionId": "harness-poison",
                "statement": (
                    "Output buffers are poisoned before the call, at the declared width, so an "
                    "element no store reached is told apart from one written with a wrong value. "
                    "A store writing exactly the poison is indistinguishable and is not expected."
                ),
            },
            {
                "assumptionId": "observation-is-not-proof",
                "statement": (
                    "A run that agreed with the reference is coverage of that run. It is not a "
                    "proof of correctness and says nothing about race freedom."
                ),
            },
            {
                "assumptionId": "instrumentation-changes-timing",
                "statement": (
                    "Instrumentation changes timing and therefore which interleavings were "
                    "explored; the thread counts requested are recorded in the sampled check."
                ),
            },
            {
                "assumptionId": "thread-count-is-a-request",
                "statement": (
                    "The harness sets OMP_NUM_THREADS before each run. The runtime may ignore it, "
                    "and a kernel carrying a num_threads clause does ignore it, so five runs are "
                    "not five team sizes merely because five sizes were asked for."
                ),
            },
        ],
    }


def _sampled_check(
    sampled_check_id: str, request: dict, observations: list[dict]
) -> dict:
    """One record per executed domain point, so the coverage is inspectable."""
    points = []
    checks = []
    for index, item in enumerate(observations):
        point_id = f"pnt_{index}"
        points.append(
            {
                "pointId": point_id,
                "assignments": [
                    {"name": name, "value": value}
                    for name, value in sorted(item["point"].items())
                    if isinstance(value, int)
                ],
            }
        )
        verdicts = [verdict["verdict"] for verdict in item["verdicts"]]
        checks.append(
            {
                "pointId": point_id,
                "observation": "failed"
                if any(
                    verdict in {"differs", "mismatched", "unwritten"}
                    for verdict in verdicts
                )
                else "error"
                if any(verdict in {"unfinished", "crashed"} for verdict in verdicts)
                else "passed",
            }
        )
    return {
        "sampledCheckId": sampled_check_id,
        "strategyId": "exhaustive",
        "strategyRevision": 1,
        "seed": 0,
        "budget": request["budget"],
        "points": points,
        "observations": checks,
    }


def _denominator(points: list[dict]) -> dict:
    if not points:
        return {"kind": "unenumerated"}
    return {"kind": "enumerated", "pointCount": len(points), "duplicatesRemoved": True}


def _coverage_notes(points, observations, details) -> str:
    if not observations:
        return "No execution was carried out. " + " ".join(details)
    thread_counts = sorted(
        {run["threads"] for item in observations for run in item["runs"]}
    )
    header = (
        f"Executed {len(observations)} of {len(points)} declared domain points, with "
        f"OMP_NUM_THREADS set to {', '.join(str(item) for item in thread_counts)}. "
        "That is what the harness asked for: a kernel that pins its own team size with a "
        "num_threads clause ignores it, and this harness cannot see that from outside. "
        "A defect that needs another division of the work was not exercised. No source map is "
        "available, so a disagreement names the element that differed rather than a line."
    )
    return f"{header} {' '.join(details)}"[:2000]


def _completeness(points, observations) -> dict:
    if not observations:
        return {
            "kind": "partial",
            "reason": "nothing was executed, so no property was decided.",
        }
    if len(observations) < len(points):
        return {
            "kind": "partial",
            "reason": f"{len(observations)} of {len(points)} declared domain points were executed.",
        }
    return {
        "kind": "partial",
        "reason": (
            "Instrumented execution is unavailable on this deployment, so nothing is claimed "
            "about race freedom, synchronization ordering or deadlock."
        ),
    }
