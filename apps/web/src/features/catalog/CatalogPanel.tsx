"use client";

/**
 * The public catalog: reviewed defects and their controls, one page at a time.
 * The page is read from `?page=`, so the list is shareable and survives a reload.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import { failureMessage } from "../common/http";
import type { Page } from "../common/page";
import { usePageParam } from "../common/use-page-param";
import { useBrowserLocation } from "../auth/use-browser-location";
import { formatDate } from "../scripts/ScriptsPanel";
import { Pager } from "../ui/Pager";
import { badge, compactButton, emptyState, errorText, heading, lead, panel, tableCell, tableHead } from "../ui/classes";
import { CATALOG_PAGE_SIZE, type CatalogSummary, kindLabel, listCatalog } from "./catalog-api";

export function CatalogPanel() {
  const here = useBrowserLocation();
  const [page, setPage] = usePageParam();
  const [data, setData] = useState<Page<CatalogSummary>>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let live = true;
    setBusy(true);
    setError(undefined);
    listCatalog(page, CATALOG_PAGE_SIZE)
      .then((value) => {
        if (live) setData(value);
      })
      .catch((failure: unknown) => {
        if (live) setError(failureMessage(failure));
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [page]);

  return (
    <section aria-labelledby="catalog-title">
      <h1 id="catalog-title" className={heading}>
        Catalog
      </h1>
      <p className={lead}>
        Reviewed examples. Each defect is paired with a control, so a check is shown both to fire and to stay quiet. Save an example to your
        scripts to edit and analyse it.
      </p>
      {error && (
        <p role="alert" className={`${errorText} mt-6`}>
          {error}
        </p>
      )}
      {!error && data && data.items.length === 0 && <p className={`${emptyState} mt-6`}>The catalog is empty.</p>}
      {data && data.items.length > 0 && (
        <div className={`${panel} mt-6 overflow-x-auto`}>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th scope="col" className={tableHead}>
                  Example
                </th>
                <th scope="col" className={tableHead}>
                  Kind
                </th>
                <th scope="col" className={tableHead}>
                  Updated
                </th>
                <th scope="col" className={tableHead}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="hover:bg-code/60">
                  <td className={tableCell}>
                    <span className="font-medium text-ink">{item.title}</span>
                    <span className="mt-0.5 block text-muted">{item.summary}</span>
                  </td>
                  <td className={tableCell}>
                    <span className={badge}>{kindLabel(item.kind)}</span>
                  </td>
                  <td className={`${tableCell} whitespace-nowrap text-muted`}>{formatDate(item.updatedAt)}</td>
                  <td className={`${tableCell} text-right`}>
                    <Link className={compactButton} href={`/catalog/item/?id=${encodeURIComponent(item.id)}${here.fragment}`}>
                      Open<span className="sr-only"> {item.title}</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.pagination.totalPages > 1 && (
        <Pager
          page={data.pagination.page}
          totalPages={data.pagination.totalPages}
          total={data.pagination.total}
          busy={busy}
          onPage={setPage}
        />
      )}
    </section>
  );
}
