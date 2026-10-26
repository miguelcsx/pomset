/** Closing an editor never removes source from the workspace or analyzed snapshot. */
export interface Tabs {
  readonly closed: readonly string[];
  readonly recent: readonly string[];
}
export type CloseMode = "one" | "others" | "all";
export function closeTabs(
  state: Tabs,
  paths: readonly string[],
  active: string,
  target: string,
  mode: CloseMode,
): { state: Tabs; active?: string } {
  const visible = paths.filter((path) => !state.closed.includes(path));
  const closing = visible.filter(
    (path) =>
      mode === "all" || (mode === "others" ? path !== target : path === target),
  );
  const closed = [
    ...new Set([
      ...state.closed.filter((path) => paths.includes(path)),
      ...closing,
    ]),
  ];
  const remaining = paths.filter((path) => !closed.includes(path));
  const index = visible.indexOf(active);
  const next =
    mode === "others" && remaining.includes(target)
      ? target
      : remaining.includes(active)
        ? active
        : remaining[Math.min(Math.max(index, 0), remaining.length - 1)];
  return {
    state: {
      closed,
      recent: [
        ...state.recent.filter(
          (path) => paths.includes(path) && !closing.includes(path),
        ),
        ...closing,
      ].slice(-100),
    },
    ...(next ? { active: next } : {}),
  };
}
export function openTab(state: Tabs, path: string): Tabs {
  return {
    closed: state.closed.filter((item) => item !== path),
    recent: state.recent.filter((item) => item !== path),
  };
}
