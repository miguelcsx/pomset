"use client";

/**
 * The header of the account, script and admin pages. The workbench has its own
 * account controls inside its toolbar, because its full-height layout leaves no
 * room for a bar above it.
 *
 * Every link carries the workbench capability fragment, when the page was
 * opened with one, so moving between site pages never drops a local session.
 */

import { Icon } from "@pomset/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { signOut } from "../auth/auth-api";
import { authHref, currentPath } from "../auth/navigation";
import { useBrowserLocation } from "../auth/use-browser-location";
import { useSession } from "../auth/use-session";
import { badge, compactButton, iconButton, linkButton } from "../ui/classes";
import type { Theme } from "../theme/use-theme";

export interface SiteHeaderProps {
  readonly compact?: boolean;
  readonly theme: Theme;
  readonly onThemeChange: (theme: Theme) => void;
}

export function SiteHeader({ compact = false, theme, onThemeChange }: SiteHeaderProps) {
  const state = useSession();
  const here = useBrowserLocation();
  const at = (path: string) => `${path}${here.fragment}`;

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href={at("/")} className="text-base font-semibold text-ink no-underline">
          pomset
        </Link>
        {!compact && (
          <nav aria-label="Site" className="flex flex-wrap gap-4 text-sm">
            <Link className={linkButton} href={at("/catalog/")}>
              Catalog
            </Link>
            {state.status === "signed-in" && (
              <Link className={linkButton} href={at("/mis-scripts/")}>
                My scripts
              </Link>
            )}
            {state.status === "signed-in" && state.session.user.role === "admin" && (
              <Link className={linkButton} href={at("/admin/")}>
                Users
              </Link>
            )}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-3 text-sm">
          {!compact && state.status === "signed-in" && (
            <SignedIn name={state.session.user.displayName} role={state.session.user.role} home={at("/")} />
          )}
          {!compact && state.status === "signed-out" && (
            <>
              <Link className={linkButton} href={authHref("/login", currentPath(), here.fragment)}>
                Sign in
              </Link>
              <Link className={linkButton} href={authHref("/register", currentPath(), here.fragment)}>
                Create account
              </Link>
            </>
          )}
          <ThemeToggle theme={theme} onChange={onThemeChange} />
        </div>
      </div>
    </header>
  );
}

function ThemeToggle({ theme, onChange }: { readonly theme: Theme; readonly onChange: (theme: Theme) => void }) {
  const label = theme === "dark" ? "Use light appearance" : "Use dark appearance";
  return (
    <button type="button" className={iconButton} title={label} aria-label={label} onClick={() => onChange(theme === "dark" ? "light" : "dark")}>
      <Icon name={theme === "dark" ? "sun" : "moon"} size={17} />
    </button>
  );
}

function SignedIn({ name, role, home }: { readonly name: string; readonly role: string; readonly home: string }) {
  const router = useRouter();
  return (
    <>
      <span className="text-ink">
        {name}
        <span className={`${badge} ml-2`}>{role}</span>
      </span>
      <button
        type="button"
        className={compactButton}
        onClick={() => {
          signOut();
          router.replace(home);
        }}
      >
        Sign out
      </button>
    </>
  );
}
