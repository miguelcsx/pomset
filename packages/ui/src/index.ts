/**
 * `@pomset/ui` owns the tokens and the workbench primitives shared between the
 * hosted workbench and the read-only local viewer. The app owns routing, data
 * access and layout; the workbench renders evidence, and never analyses,
 * measures or decides eligibility.
 */

export { renderReportPage, roleFor, type ReportPageOptions } from "./report-page.js";
export {
  SPACING,
  STATUS_ROLES,
  STATUS_ROLE_LABELS,
  type Spacing,
  type StatusRole,
} from "./tokens.js";
export { Inspector, type InspectorProps } from "./Inspector.js";
export type { InspectionDocument, SourceSelection } from "./inspection.js";

export { Icon, type IconName } from "./Icon.js";

export { EvidencePanel } from "./EvidencePanel.js";
