import type { AnalysisResult } from "@pomset/contracts";
import { domainRows } from "./domain-rows.js";
import { propertyLabel } from "./property-labels.js";
/** Each cell is an actual region classification, never an estimated percentage. */
export function DomainMap({ analysis }: { analysis: AnalysisResult }) {
  const properties = analysis.propertyResults;
  const denominator = analysis.coverage.denominator;
  return <div className="domain-map"><div className="visual-caption"><span>Declared domain</span><span>{denominator.kind === "enumerated" && denominator.pointCount !== undefined ? `${denominator.pointCount.toLocaleString("en-US")} points` : "Non-enumerated"}</span></div>
    <div className="domain-matrix"><table><thead><tr><th>Region</th>{properties.map((property) => <th key={property.propertyId}>{propertyLabel(property.propertyId)}</th>)}</tr></thead><tbody>{domainRows(analysis.coverage.regions).map((region, index) => <tr key={region.regionId}><th title={region.constraints.join("; ")}>{region.label ?? `Region ${index + 1}`}</th>{properties.map((property) => {
      const value = region.classifications.find((item) => item.propertyId === property.propertyId);
      return <td key={property.propertyId}><span className={`domain-cell ${value?.classification ?? "unknown"}`} title={`${value?.classification ?? "Unclassified"} · ${value?.method ?? "no method"}. ${region.constraints.join("; ")}`}><span aria-hidden="true">{value?.classification === "established" ? "✓" : value?.classification === "violated" ? "!" : value?.classification === "unsupported" ? "—" : "?"}</span><small>{value?.classification ?? "unclassified"}</small></span></td>;
    })}</tr>)}</tbody></table></div><small className="visual-footnote">Cells describe model classifications, not executed samples or proportions.</small></div>;
}
