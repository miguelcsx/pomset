/**
 * Which launch form a scenario declares, and what it contains.
 *
 * A scenario is launched either as program instances — which says where on a
 * device each instance runs — or as a host thread team, which says how the
 * runtime parallelises work the kernel does not place. Those are one union in
 * the contract and one branch here, so nothing that reads a launch has to guess
 * whether `grid` is present before touching it.
 */

import type { IntExpr, LaunchConfig, ProgramInstanceLaunch } from "./generated/index.js";

/**
 * The discriminator. The two forms cannot both match: each refuses the other's
 * members, so structural narrowing is exact rather than a guess.
 */
export function isProgramInstanceLaunch(
  launch: LaunchConfig,
): launch is ProgramInstanceLaunch {
  return "grid" in launch && "block" in launch;
}

/** Every expression a launch declares, whichever form it takes. */
export function launchExpressions(launch: LaunchConfig): readonly IntExpr[] {
  if (isProgramInstanceLaunch(launch))
    return [
      ...launch.grid,
      ...launch.block,
      ...(launch.numWarps ? [launch.numWarps] : []),
      ...(launch.numStages ? [launch.numStages] : []),
    ];
  return [
    ...(launch.threads ? [launch.threads] : []),
    ...(launch.chunk ? [launch.chunk] : []),
  ];
}

/**
 * Which backend a scenario's launch form belongs to.
 *
 * The form is the declaration of how the kernel is placed, and only one backend
 * places kernels that way. Deciding the backend from anything else — a flag, a
 * remembered preference — would let a scenario be handed to an engine that
 * cannot run it.
 */
export function backendForLaunch(launch: LaunchConfig): "triton" | "openmp" {
  return isProgramInstanceLaunch(launch) ? "triton" : "openmp";
}
