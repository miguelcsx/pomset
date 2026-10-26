"""Construct portable evidence solely from actual query answers and source ASTs."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from .coverage import MODEL_NAME, MODEL_REVISION, CoverageAnswer
from .domain_points import enumerated_points
from .extract import Extraction


def identifier(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex}"


def now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def portable_value(value):
    if type(value) is int and abs(value) > (1 << 53) - 1:
        return str(value)
    return str(value) if type(value) is bool else value


def assumptions(scenario: dict, domain_id: str) -> dict:
    widths = ", ".join(
        f"{v['name']}:{v.get('width', 'i32')}"
        for v in scenario["domain"]["variables"]
        if v["type"] == "int"
        or v.get("values")
        and all(type(value) is int for value in v["values"])
    )
    statements = [
        (
            "other",
            "Addresses and masks are modeled; stored values are uninterpreted. No numerical claim follows.",
        ),
        (
            "width",
            f"Modular arithmetic at declared widths ({widths}); program_id/arange are i32. Same-signedness integer promotion only.",
        ),
        (
            "aliasing",
            "Contiguous one-dimensional allocations are disjoint. Declared alias groups are unsupported.",
        ),
        (
            "ordering",
            "Conflict query concerns distinct program/lane actors and non-atomic stores; no GPU schedule is modeled.",
        ),
    ]
    return {
        "model": MODEL_NAME,
        "modelRevision": MODEL_REVISION,
        "domainRef": domain_id,
        "items": [
            {"assumptionId": identifier("asm"), "kind": kind, "statement": statement}
            for kind, statement in statements
        ],
    }


def build_analysis_result(
    request: dict,
    scenario: dict,
    extraction: Extraction | None,
    answer: CoverageAnswer | list[CoverageAnswer],
    domain_id: str,
) -> dict:
    answers = answer if isinstance(answer, list) else [answer]
    result_id, coverage_id = identifier("res"), identifier("cov")
    try:
        points = enumerated_points(scenario["domain"])
    except Exception:
        # An unsupported query must remain reportable even if its domain cannot
        # be enumerated. No denominator is inferred in that case.
        points = []
    denominator = (
        {"kind": "enumerated", "pointCount": len(points), "duplicatesRemoved": True}
        if points
        else {"kind": "unenumerated"}
    )
    properties, findings, witnesses, actors, events = [], [], [], [], []
    regions = []
    all_constraints = [
        f"Declared domain {domain_id}; all ranges, value sets, steps and constraints apply."
    ]
    for checked in answers:
        outcome = {
            "sat": "violated",
            "unsat": "established",
            "unknown": "unknown",
            "unsupported": "unsupported",
        }[checked.status]
        prop = {
            "propertyResultId": identifier("pr"),
            "propertyId": checked.property_id,
            "outcome": outcome,
            "method": "symbolic",
            "evidenceClass": "counterexample"
            if outcome == "violated"
            else "verified-under-assumptions"
            if outcome == "established"
            else "potential",
            "assumptions": assumptions(scenario, domain_id),
            "coverageRef": coverage_id,
            "budget": request["budget"],
        }
        if outcome in {"unknown", "unsupported"}:
            prop[outcome + "Reason"] = checked.reason or "No decision available."
        classification = "unknown" if outcome == "violated" else outcome
        regions.append(
            {
                "regionId": identifier("region"),
                "constraints": all_constraints,
                "classifications": [
                    {
                        "propertyId": checked.property_id,
                        "classification": classification,
                        "method": "symbolic",
                        "resultId": result_id,
                    }
                ],
            }
        )
        if checked.witness and extraction:
            concrete = checked.witness
            witness_id, finding_id = identifier("witness"), identifier("finding")
            ranges, actor_ids, event_ids = [], [], []
            for position, access_index in enumerate(concrete["accessIndices"]):
                access = extraction.accesses[access_index]
                actor_id, event_id = identifier("actor"), identifier("event")
                actor = {
                    "actorId": actor_id,
                    "kind": "symbolic-domain",
                    "label": "Symbolic lane domain (no concrete writer for an output hole)",
                }
                suffix = "A" if position == 0 else "B"
                if "program" + suffix in concrete:
                    actor.update(
                        kind="lane",
                        label=f"Program {concrete['program' + suffix]}, lane {concrete['lane' + suffix]}",
                        coordinates={
                            "program": concrete["program" + suffix],
                            "lane": concrete["lane" + suffix],
                        },
                    )
                elif "program" in concrete:
                    actor.update(
                        kind="lane",
                        label=f"Program {concrete['program']}, lane {concrete['lane']}",
                        coordinates={
                            "program": concrete["program"],
                            "lane": concrete["lane"],
                        },
                    )
                event = {
                    "eventId": event_id,
                    "actorId": actor_id,
                    "operation": "write" if access.kind == "store" else "read",
                    "scope": "lane",
                    "addressExpr": access.lane_expression,
                    "maskExpr": access.mask_expression or "True",
                    "allocationId": concrete["allocationId"],
                    "sourceRanges": [access.source_range],
                }
                actors.append(actor)
                events.append(event)
                ranges.append(access.source_range)
                actor_ids.append(actor_id)
                event_ids.append(event_id)
            assignments = [
                {"name": name, "value": portable_value(value)}
                for name, value in sorted(concrete["assignments"].items())
            ]
            objective = concrete.get("index", concrete.get("address"))
            assignments.append(
                {
                    "name": "outputIndex" if "index" in concrete else "elementOffset",
                    "value": portable_value(objective),
                }
            )
            witnesses.append(
                {
                    "witnessId": witness_id,
                    "kind": "output-index" if "index" in concrete else "domain-point",
                    "assignments": assignments,
                    "actorIds": actor_ids,
                    "eventIds": event_ids,
                    "sourceRanges": ranges,
                    "minimization": concrete["minimization"],
                    "replay": {
                        "method": "cpu-interpreter",
                        "outcome": "blocked",
                        "note": "No independent replay was executed; requires compatible tooling and per-invocation consent.",
                    },
                }
            )
            findings.append(
                {
                    "schemaVersion": 1,
                    "findingId": finding_id,
                    "propertyId": checked.property_id,
                    "evidenceClass": "counterexample",
                    "title": {
                        "outputCoverage": "An output element has no enabled write",
                        "memoryBounds": "An enabled access exceeds its allocation",
                        "writeWriteConflict": "Two distinct writers reach the same address",
                    }.get(
                        checked.property_id,
                        f"Model counterexample for {checked.property_id}",
                    ),
                    "explanation": f"Element offset {objective}; grid {concrete['grid']}, block {concrete['block']}. Qualified by the declared model and domain.",
                    "actorIds": actor_ids,
                    "eventIds": event_ids,
                    "sourceRanges": ranges,
                    "witnessId": witness_id,
                    "allocationIds": [concrete["allocationId"]],
                    "backendId": "triton",
                    "provenance": [
                        {
                            "sourceId": request["snapshotId"],
                            "method": "symbolic",
                            "tool": "Z3",
                            "toolVersion": checked.solver_version,
                        }
                    ],
                }
            )
            prop.update(witnessIds=[witness_id], findingIds=[finding_id])
            regions[-1]["constraints"].append(
                f"Excludes the concrete domain point in witness {witness_id}."
            )
            regions.append(
                {
                    "regionId": identifier("region"),
                    "constraints": [
                        f"{name} == {value!r}"
                        for name, value in concrete["assignments"].items()
                    ],
                    "classifications": [
                        {
                            "propertyId": checked.property_id,
                            "classification": "violated",
                            "method": "symbolic",
                            "resultId": result_id,
                        }
                    ],
                }
            )
        properties.append(prop)
    return {
        "schemaVersion": 1,
        "resultId": result_id,
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
        "method": "symbolic",
        "queryRevision": "memory-2",
        "propertyResults": properties,
        "coverage": {
            "coverageId": coverage_id,
            "domainRef": domain_id,
            "regions": regions,
            "denominator": denominator,
        },
        "budget": request["budget"],
        "completeness": {"kind": "complete"},
        "createdAt": now(),
        "actors": actors,
        "events": events,
        "findings": findings,
        "witnesses": witnesses,
    }
