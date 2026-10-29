/**
 * Shared class strings for the site pages. They are written out in full so
 * Tailwind's scanner finds every utility; none of them is built at run time.
 */

export const panel = "rounded-lg border border-line bg-surface";

export const field =
  "mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-2 focus:outline-offset-1 focus:outline-accent disabled:opacity-60 aria-[invalid=true]:border-danger";

export const primaryButton =
  "inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryButton =
  "inline-flex items-center justify-center rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-code focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60";

export const dangerButton =
  "inline-flex items-center justify-center rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:cursor-not-allowed disabled:opacity-60";

export const linkButton =
  "text-sm font-medium text-accent underline underline-offset-2 hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-accent";

export const errorText = "text-sm text-danger";

export const noticeBox = "rounded-md border border-danger bg-danger-soft p-3 text-sm text-danger";

export const heading = "text-2xl font-semibold tracking-tight text-ink";

export const tableCell = "border-t border-line px-3 py-2 align-top text-sm";

export const tableHead = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted";
