"use client";

/**
 * Guards a page behind a session, and optionally behind a role.
 *
 * Renders nothing while the stored session is being read, so a signed-in user
 * never sees a redirect flash. A signed-out visitor is sent to sign-in with
 * the page they asked for as `next`. A signed-in user without the role sees a
 * 403 notice instead; the API enforces the same rule on every admin request.
 */

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { noticeBox } from "../ui/classes";
import type { Role } from "./account";
import { authHref, currentPath, readFragment } from "./navigation";
import { useSession } from "./use-session";

export interface ProtectedRouteProps {
  readonly role?: Role;
  readonly children: ReactNode;
}

export function ProtectedRoute({ role, children }: ProtectedRouteProps) {
  const state = useSession();
  const router = useRouter();
  const signedOut = state.status === "signed-out";

  useEffect(() => {
    if (signedOut) router.replace(authHref("/login", currentPath(), readFragment()));
  }, [signedOut, router]);

  if (state.status !== "signed-in") return null;
  if (role !== undefined && state.session.user.role !== role) {
    return (
      <section aria-labelledby="forbidden-title" className="mx-auto max-w-2xl px-4 py-10">
        <h1 id="forbidden-title" className="text-2xl font-semibold text-ink">
          Error 403: not available
        </h1>
        <p role="alert" className={`${noticeBox} mt-4`}>
          This page is for administrators. Your account does not have access to it.
        </p>
      </section>
    );
  }
  return <>{children}</>;
}
