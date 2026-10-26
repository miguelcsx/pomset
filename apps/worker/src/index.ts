/**
 * `@pomset/worker` supervises engine processes and consumes leased hosting rows.
 * It owns cancellation and the resource limits; the engine owns analysis only.
 *
 * The attempt, lease, commit and execution modules land here.
 */

export {};
export { runSymbolic, probeProfile, REPO_ROOT } from "./symbolic.js";
