"use client";

/**
 * The current page of a list, kept in a query parameter (`?page=` by default) so
 * a reload or a shared link returns to the same page. A page with two lists
 * gives each its own key. Changing it keeps the workbench capability fragment,
 * which a local session needs to stay signed in as the list moves.
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { pageFromQuery } from "./page";

export function usePageParam(key = "page"): readonly [number, (page: number) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const page = pageFromQuery(params.get(key));

  const setPage = useCallback(
    (next: number) => {
      const query = new URLSearchParams(params.toString());
      if (next <= 1) query.delete(key);
      else query.set(key, String(next));
      const search = query.toString();
      const fragment = typeof location === "undefined" ? "" : location.hash;
      router.replace(`${pathname}${search ? `?${search}` : ""}${fragment}`, { scroll: false });
    },
    [key, params, pathname, router],
  );

  return [page, setPage];
}
