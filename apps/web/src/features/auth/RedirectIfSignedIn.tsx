"use client";

/**
 * Sends a signed-in visitor away from the sign-in and registration pages, to the
 * `next` they were given, or the home page. Renders nothing; the page's form may
 * show for an instant before the redirect replaces it.
 */

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { afterSignInHref, nextFromLocation, readFragment } from "./navigation";
import { useSession } from "./use-session";

export function RedirectIfSignedIn() {
  const router = useRouter();
  const state = useSession();

  useEffect(() => {
    if (state.status === "signed-in") {
      router.replace(afterSignInHref(nextFromLocation(), readFragment()));
    }
  }, [state.status, router]);

  return null;
}
