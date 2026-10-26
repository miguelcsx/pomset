/**
 * The report page.
 *
 * One renderer for the local viewer and, later, the hosted workbench: the same
 * page is served over the read-only local transport and by the API, so the two
 * cannot drift.
 *
 * Three rules shape it. A status is never carried by colour alone, so every role
 * renders its label as well as its hue. A result is never shown without what
 * qualifies it, so coverage, assumptions and budget sit beside the outcome. And
 * an empty or failed run states what happened rather than showing a blank panel.
 */

import { STATUS_ROLES, STATUS_ROLE_LABELS, type StatusRole } from "./tokens.js";

/** The role that decorates one property outcome. */
export function roleFor(outcome: string): StatusRole {
  switch (outcome) {
    case "violated":
      return "violation";
    case "unsupported":
    case "unknown":
      return "unknown";
    case "established":
      return "contract";
    default:
      return "caution";
  }
}

export interface ReportPageOptions {
  /** The report document, embedded so the page renders without a second fetch. */
  readonly report: unknown;
  readonly title?: string;
}

const STYLES = `
  :root {
    --violation: #b3261e; --caution: #8a5a00; --activity: #1d4ed8;
    --unknown: #5b5b5b; --contract: #14532d;
    --surface: #ffffff; --muted: #6b7280; --line: #e5e7eb; --ink: #111827;
  }
  @media (prefers-color-scheme: dark) {
    :root { --surface: #0b0f14; --ink: #e5e7eb; --muted: #9ca3af; --line: #1f2937;
            --violation: #f87171; --caution: #fbbf24; --activity: #93c5fd;
            --unknown: #cbd5e1; --contract: #6ee7b7; }
  }
  body { margin: 0; background: var(--surface); color: var(--ink);
         font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, sans-serif; }
  main { max-width: 60rem; margin: 0 auto; padding: 32px 16px 64px; }
  h1 { font-size: 1.25rem; margin: 0 0 4px; }
  .sub { color: var(--muted); margin: 0 0 24px; }
  section { border: 1px solid var(--line); border-radius: 8px; padding: 16px; margin-bottom: 16px; }
  .row { display: flex; gap: 8px; align-items: baseline; justify-content: space-between; }
  .role { font-weight: 600; text-transform: none; }
  .role.violation { color: var(--violation); } .role.caution { color: var(--caution); }
  .role.activity { color: var(--activity); } .role.unknown { color: var(--unknown); }
  .role.contract { color: var(--contract); }
  .chip { border: 1px solid currentColor; border-radius: 999px; padding: 1px 10px; font-size: .8rem; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 12px 0 0; }
  dt { color: var(--muted); } dd { margin: 0; }
  ul { margin: 8px 0 0; padding-left: 20px; }
  .empty { color: var(--muted); }
  code { background: color-mix(in srgb, var(--line) 45%, transparent); padding: 1px 5px; border-radius: 4px; }
`;

/**
 * Renders the page for one report. The five roles are the only decoration the
 * outcome gets, and each is accompanied by its label.
 */
export function renderReportPage(options: ReportPageOptions): string {
  const title = options.title ?? "pomset report";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${STYLES}</style>
</head>
<body>
<main>
  <h1>pomset</h1>
  <p class="sub">Behaviour envelope report. Rendered from the run's own record; nothing here re-derives a verdict.</p>
  <div id="report"></div>
</main>
<script id="pomset-report" type="application/json">${JSON.stringify(options.report).replace(/</g, "\\u003c")}</script>
<script>
const ROLES = ${JSON.stringify(STATUS_ROLES)};
const LABELS = ${JSON.stringify(STATUS_ROLE_LABELS)};
const report = JSON.parse(document.getElementById("pomset-report").textContent);
const root = document.getElementById("report");
const esc = (value) => String(value).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const roleFor = (outcome) => outcome === "violated" ? "violation"
  : outcome === "established" ? "contract"
  : (outcome === "unknown" || outcome === "unsupported") ? "unknown" : "caution";

function section(title, body) {
  return '<section><div class="row"><strong>' + esc(title) + "</strong></div>" + body + "</section>";
}

if (report && report.failure) {
  root.innerHTML = section("Run failed", '<p class="role unknown"><span class="chip">' +
    esc(LABELS.unknown) + "</span> " + esc(report.failure.code) + ": " + esc(report.failure.message) +
    '</p><p class="empty">No result was produced, so nothing is claimed about the kernel.</p>');
} else if (!report || !report.properties || report.properties.length === 0) {
  root.innerHTML = section("No results", '<p class="empty">This run produced no property results yet.</p>');
} else {
  const provenance = '<dl>' +
    '<dt>Job</dt><dd><code>' + esc(report.jobId) + "</code></dd>" +
    '<dt>Snapshot</dt><dd><code>' + esc(report.snapshotId) + "</code></dd>" +
    '<dt>Scenario</dt><dd><code>' + esc(report.scenarioId) + "</code></dd>" +
    '<dt>Profile revision</dt><dd><code>' + esc(report.profileRevisionId) + "</code></dd>" +
    '<dt>Policy</dt><dd><code>' + esc(report.policyId) + "@" + esc(report.policyRevision) + "</code></dd>" +
    "</dl>";
  root.innerHTML = section("Provenance", provenance) +
    report.properties.map((property) => {
      const role = roleFor(property.outcome);
      const detail = property.unknownReason || property.unsupportedReason;
      return section(property.propertyId,
        '<div class="row"><span class="role ' + role + '">' +
          '<span class="chip">' + esc(LABELS[role]) + "</span> " + esc(property.outcome) + "</span>" +
        '<span class="sub">' + esc(property.method) + " · " + esc(property.evidenceClass) + "</span></div>" +
        (detail ? '<p class="empty">' + esc(detail) + "</p>" : ""));
    }).join("") +
    section("What qualifies these numbers",
      '<dl><dt>Coverage denominator</dt><dd>' + esc(report.qualifiers.coverage.kind) +
      (report.qualifiers.coverage.pointCount !== undefined
        ? " (" + esc(report.qualifiers.coverage.pointCount) + " points, duplicates removed)" : "") +
      "</dd><dt>Assumptions</dt><dd>" +
      (report.qualifiers.assumptions.length
        ? "<ul>" + report.qualifiers.assumptions.map((a) => "<li>" + esc(a) + "</li>").join("") + "</ul>"
        : '<span class="empty">none stated</span>') +
      "</dd></dl>") +
    section("Events", "<ul>" + report.events.map((event) =>
      "<li><code>" + esc(event.sequence) + "</code> " + esc(event.type) + "</li>").join("") + "</ul>");
}
</script>
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] as string,
  );
}
