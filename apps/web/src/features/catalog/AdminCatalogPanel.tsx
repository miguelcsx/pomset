"use client";

/**
 * The administrator's side of the catalog: list the examples, add one, or remove
 * one after confirming. Editing an existing example is not offered here yet; the
 * API accepts it, the page does not.
 */

import { type FormEvent, useEffect, useState } from "react";

import { failureMessage } from "../common/http";
import type { JsonObject } from "../common/json";
import type { Page } from "../common/page";
import { usePageParam } from "../common/use-page-param";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Pager } from "../ui/Pager";
import { badge, emptyState, errorText, field, heading, lead, outlineDangerButton, panel, primaryButton, tableCell, tableHead } from "../ui/classes";
import {
  CATALOG_KINDS,
  CATALOG_PAGE_SIZE,
  type CatalogKind,
  type CatalogSummary,
  createCatalogItem,
  deleteCatalogItem,
  kindLabel,
  listCatalog,
} from "./catalog-api";

export function AdminCatalogPanel() {
  const [page, setPage] = usePageParam("catalogPage");
  const [version, setVersion] = useState(0);
  const [data, setData] = useState<Page<CatalogSummary>>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(true);
  const [removing, setRemoving] = useState<CatalogSummary>();
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string>();

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
  }, [page, version]);

  async function remove() {
    if (!removing) return;
    setRemoveBusy(true);
    setRemoveError(undefined);
    try {
      await deleteCatalogItem(removing.id);
      setRemoving(undefined);
      // Removing the last example on a later page would leave that page empty.
      if (data && data.items.length === 1 && page > 1) setPage(page - 1);
      else setVersion((value) => value + 1);
    } catch (failure) {
      setRemoveError(failureMessage(failure));
    } finally {
      setRemoveBusy(false);
    }
  }

  return (
    <section aria-labelledby="admin-catalog-title" className="mt-12">
      <h2 id="admin-catalog-title" className={heading}>
        Catalog
      </h2>
      <p className={lead}>Reviewed examples offered to every visitor. Removing one does not touch the scripts that were copied from it.</p>
      {error && (
        <p role="alert" className={`${errorText} mt-6`}>
          {error}
        </p>
      )}
      {data && data.items.length === 0 && <p className={`${emptyState} mt-6`}>The catalog is empty.</p>}
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
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="hover:bg-code/60">
                  <td className={`${tableCell} font-medium text-ink`}>{item.title}</td>
                  <td className={tableCell}>
                    <span className={badge}>{kindLabel(item.kind)}</span>
                  </td>
                  <td className={`${tableCell} text-right`}>
                    <button
                      type="button"
                      className={outlineDangerButton}
                      onClick={() => {
                        setRemoveError(undefined);
                        setRemoving(item);
                      }}
                    >
                      Remove<span className="sr-only"> {item.title}</span>
                    </button>
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

      <ConfirmDialog
        open={removing !== undefined}
        title="Remove this example?"
        message={`"${removing?.title ?? ""}" will leave the catalog. Scripts that were saved from it keep their copy and lose the link.`}
        confirmLabel="Remove"
        busy={removeBusy}
        error={removeError}
        onConfirm={() => void remove()}
        onCancel={() => setRemoving(undefined)}
      />

      <CreateForm onCreated={() => setVersion((value) => value + 1)} />
    </section>
  );
}

function parseScenario(text: string): JsonObject | undefined {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as JsonObject) : undefined;
  } catch {
    return undefined;
  }
}

function CreateForm({ onCreated }: { readonly onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [kind, setKind] = useState<CatalogKind>("defect");
  const [expectedOutcome, setExpectedOutcome] = useState("");
  const [source, setSource] = useState("");
  const [scenarioText, setScenarioText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const scenario = parseScenario(scenarioText);
    if (scenario === undefined) {
      setError("The scenario must be a JSON object.");
      return;
    }
    setBusy(true);
    try {
      await createCatalogItem({ title, summary, kind, source, scenario, expectedOutcome });
      setTitle("");
      setSummary("");
      setExpectedOutcome("");
      setSource("");
      setScenarioText("");
      onCreated();
    } catch (failure) {
      setError(failureMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className={`${panel} mt-10 grid gap-5 p-6 sm:grid-cols-2`}
      onSubmit={(event) => void submit(event)}
      aria-labelledby="new-example-title"
    >
      <div className="sm:col-span-2">
        <h3 id="new-example-title" className="text-base font-semibold text-ink">
          Add an example
        </h3>
        <p className="mt-1 text-sm text-muted">The kernel and the scenario are checked by the analysis before the example is offered.</p>
      </div>
      <label className="block text-sm font-medium text-ink">
        Title
        <input className={field} value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} />
      </label>
      <label className="block text-sm font-medium text-ink">
        Kind
        <select className={field} value={kind} onChange={(event) => setKind(event.target.value as CatalogKind)}>
          {CATALOG_KINDS.map((value) => (
            <option key={value} value={value}>
              {kindLabel(value)}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-ink sm:col-span-2">
        Summary
        <input className={field} value={summary} onChange={(event) => setSummary(event.target.value)} required maxLength={500} />
      </label>
      <label className="block text-sm font-medium text-ink sm:col-span-2">
        Expected outcome
        <input
          className={field}
          value={expectedOutcome}
          onChange={(event) => setExpectedOutcome(event.target.value)}
          required
          maxLength={500}
        />
      </label>
      <label className="block text-sm font-medium text-ink sm:col-span-2">
        Kernel source
        <textarea
          className={`${field} font-mono text-xs`}
          rows={10}
          value={source}
          onChange={(event) => setSource(event.target.value)}
          required
        />
      </label>
      <label className="block text-sm font-medium text-ink sm:col-span-2">
        Scenario (JSON object)
        <textarea
          className={`${field} font-mono text-xs`}
          rows={10}
          value={scenarioText}
          onChange={(event) => setScenarioText(event.target.value)}
          required
        />
      </label>
      {error && (
        <p role="alert" className={`${errorText} sm:col-span-2`}>
          {error}
        </p>
      )}
      <div className="sm:col-span-2">
        <button type="submit" className={primaryButton} disabled={busy}>
          {busy ? "Adding…" : "Add example"}
        </button>
      </div>
    </form>
  );
}
