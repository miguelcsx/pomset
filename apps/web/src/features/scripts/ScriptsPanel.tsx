"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { failureMessage } from "../common/http";
import type { Page } from "../common/page";
import { Pager } from "../ui/Pager";
import { errorText, linkButton, panel, tableCell, tableHead } from "../ui/classes";
import { useBrowserLocation } from "../auth/use-browser-location";
import { listScripts, SCRIPTS_PAGE_SIZE, type ScriptSummary } from "./scripts-api";

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

export function ScriptsPanel() {
  const here = useBrowserLocation();
  const [page, setPage] = useState(1);
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
      <h1 id="scripts-title" className="text-2xl font-semibold tracking-tight text-ink">
        My scripts
      </h1>
      <p className="mt-2 text-sm text-muted">
        Scripts are saved from the workbench with <em>Save as script</em>.
      </p>
      {error && (
        <p role="alert" className={`${errorText} mt-4`}>
          {error}
        </p>
      )}
      {!error && data && data.items.length === 0 && <p className="mt-6 text-sm text-muted">You have no scripts yet.</p>}
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
                <tr key={script.id}>
                  <td className={tableCell}>{script.title}</td>
                  <td className={`${tableCell} text-muted`}>{formatDate(script.updatedAt)}</td>
                  <td className={`${tableCell} text-right`}>
                    <Link className={linkButton} href={`/mis-scripts/script/?id=${encodeURIComponent(script.id)}${here.fragment}`}>
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
