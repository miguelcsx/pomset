/**
 * Shared class strings for the site pages. They are written out in full so
 * Tailwind's scanner finds every utility; none of them is built at run time.
 * Colours come from the theme tokens in site.css, so every string follows the
 * light and dark palettes.
 */

export const panel = "rounded-lg border border-line bg-surface";

export const field =
  "mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-2 focus:outline-offset-1 focus:outline-accent disabled:opacity-60 aria-[invalid=true]:border-danger";

export const primaryButton =
  "inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-solid hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryButton =
  "inline-flex items-center justify-center rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-code focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60";

export const compactButton =
  "inline-flex items-center justify-center rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-code focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60";

export const dangerButton =
  "inline-flex items-center justify-center rounded-md bg-danger-solid px-4 py-2 text-sm font-medium text-on-solid hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:cursor-not-allowed disabled:opacity-60";

export const outlineDangerButton =
  "inline-flex items-center justify-center rounded-md border border-danger px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:cursor-not-allowed disabled:opacity-60";

export const iconButton =
  "inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-ink hover:bg-code focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const revealButton =
  "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-code hover:text-ink aria-pressed:text-accent focus-visible:outline-2 focus-visible:outline-accent";

export const linkButton =
  "text-sm font-medium text-accent underline underline-offset-2 hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-accent";

export const errorText = "text-sm text-danger";

export const noticeBox = "rounded-md border border-danger bg-danger-soft p-3 text-sm text-danger";

export const heading = "text-2xl font-semibold tracking-tight text-ink";

export const lead = "mt-2 max-w-2xl text-sm text-muted";

export const badge = "inline-flex rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent";

export const emptyState = "rounded-lg border border-dashed border-line bg-surface px-6 py-10 text-center text-sm text-muted";

export const tableCell = "border-t border-line px-4 py-3 align-middle text-sm";

export const tableHead = "bg-code px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted";
