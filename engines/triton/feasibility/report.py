"""Readable static research report generated from measured records."""

from html import escape


def render(record: dict, rows: list[dict], environment: dict) -> str:
    items = "".join(
        "<tr>"
        + "".join(
            f"<td>{escape(str(value))}</td>"
            for value in (
                row["caseId"],
                row["expected"],
                row["actual"],
                "matches finite oracle" if row["matchesOracle"] else "MISMATCH",
                row["oracle"]["firstUnwrittenIndex"],
                row["solverVersion"],
                row["elapsedNs"],
            )
        )
        + "</tr>"
        for row in rows
    )
    limitations = "".join(f"<li>{escape(item)}</li>" for item in record["limitations"])
    tools = "".join(
        f"<li>{escape(component['name'])}: {escape(component['availability'])} "
        f"{escape(component.get('version', component.get('reason', '')))}</li>"
        for component in environment["components"]
    )
    return f"""<!doctype html>
<html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pomset baseline feasibility</title>
<style>
:root {{ color-scheme: light dark; font: 16px/1.6 system-ui; }}
body {{ max-width: 75rem; margin: 2rem auto; padding: 0 1rem; }}
.decision {{ border: 2px solid; padding: 1rem; font-weight: bold; }}
.scroll {{ overflow-x: auto; }}
table {{ border-collapse: collapse; width: 100%; }}
td, th {{ border: 1px solid; padding: .5rem; text-align: left; }}
a {{ color: inherit; }}
</style>
<main><h1>Pomset baseline feasibility</h1>
<p class="decision">Decision: {escape(record["decision"])}. Dependent implementation is blocked.</p>
<p>This evaluates the existing analyzer, not the completed feasibility epic.
The finite oracle is internal; no independent comparison or GPU execution ran.</p>
<p>Environment: {escape(str(environment["platform"]))}; Python {escape(environment["python"])}.</p>
<p>Query: output coverage; existing model {escape(rows[0]["model"])},
revision {escape(rows[0]["modelRevision"])}; solver budget {rows[0]["solverBudgetMs"]} ms per query.
Times below are a single CPU measurement in nanoseconds, not GPU performance.</p>
<div class="scroll" tabindex="0" role="region" aria-label="Measured case results">
<table><caption>Expected finite-pattern answers versus current solver answers</caption>
<thead><tr><th>Case</th><th>Expected</th><th>Actual</th><th>Comparison</th>
<th>Oracle first hole</th><th>Z3 version</th><th>Elapsed ns</th></tr></thead>
<tbody>{items}</tbody></table></div>
<h2>Limitations</h2><ul>{limitations}</ul>
<h2>Installed components</h2><ul>{tools}</ul>
<p>All independent comparison rows are blocked. Tool absence is not a successful experiment.</p>
<p><a href="gate-record.json">Gate record</a> · <a href="witnesses.json">Cases, sources and witnesses</a>
· <a href="compare.json">Comparison blockers</a> · <a href="probe.json">Environment probe</a></p>
</main></html>
"""
