"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { failureMessage } from "../common/http";
import type { Page } from "../common/page";
import { usePageParam } from "../common/use-page-param";
import { Pager } from "../ui/Pager";
import { compactButton, emptyState, errorText, heading, lead, linkButton, panel, tableCell, tableHead } from "../ui/classes";
import { useBrowserLocation } from "../auth/use-browser-location";
import { listScripts, SCRIPTS_PAGE_SIZE, type ScriptSummary } from "./scripts-api";

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

export function ScriptsPanel() {
  const here = useBrowserLocation();
  const [page, setPage] = usePageParam();
  const [data, setData] = useState<Page<ScriptSummary>>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let live = true;
    setBusy(true);
    setError(undefined);
    listScripts(page, SCRIPTS_PAGE_SIZE)
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
    <section aria-labelledby="scripts-title">
      <h1 id="scripts-title" className={heading}>
        My scripts
      </h1>
      <p className={lead}>
        Scripts are saved from the workbench with <em>Save as script</em>, or as a copy of a catalog example.
      </p>
      {error && (
        <p role="alert" className={`${errorText} mt-6`}>
          {error}
        </p>
      )}
      {!error && data && data.items.length === 0 && (
        <div className={`${emptyState} mt-6`}>
          <p>You have no scripts yet.</p>
          <p className="mt-2">
            <Link className={linkButton} href={`/catalog/${here.fragment}`}>
              Browse the catalog
            </Link>{" "}
            to start from a reviewed example.
          </p>
        </div>
      )}
      {data && data.items.length > 0 && (
        <div className={`${panel} mt-6 overflow-x-auto`}>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th scope="col" className={tableHead}>
                  Title
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
              {data.items.map((script) => (
                <tr key={script.id} className="hover:bg-code/60">
                  <td className={`${tableCell} font-medium text-ink`}>{script.title}</td>
                  <td className={`${tableCell} whitespace-nowrap text-muted`}>{formatDate(script.updatedAt)}</td>
                  <td className={`${tableCell} text-right`}>
                    <Link className={compactButton} href={`/mis-scripts/script/?id=${encodeURIComponent(script.id)}${here.fragment}`}>
                      Open<span className="sr-only"> {script.title}</span>
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
