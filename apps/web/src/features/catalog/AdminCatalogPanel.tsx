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
import { errorText, field, panel, primaryButton, tableCell, tableHead } from "../ui/classes";
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
    <section aria-labelledby="admin-catalog-title" className="mt-10">
      <h2 id="admin-catalog-title" className="text-xl font-semibold tracking-tight text-ink">
        Catalog
      </h2>
      {error && (
        <p role="alert" className={`${errorText} mt-4`}>
          {error}
        </p>
      )}
      {data && data.items.length === 0 && <p className="mt-4 text-sm text-muted">The catalog is empty.</p>}
      {data && data.items.length > 0 && (
        <div className={`${panel} mt-4 overflow-x-auto`}>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th scope="col" className={tableHead}>
                  Title
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
                <tr key={item.id}>
                  <td className={tableCell}>{item.title}</td>
                  <td className={tableCell}>{kindLabel(item.kind)}</td>
                  <td className={`${tableCell} text-right`}>
                    <button
                      type="button"
                      className="text-sm font-medium text-danger underline-offset-2 hover:underline"
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
    <form className={`${panel} mt-8 grid gap-4 p-4`} onSubmit={(event) => void submit(event)} aria-labelledby="new-example-title">
      <h3 id="new-example-title" className="text-base font-semibold text-ink">
        Add an example
      </h3>
      <label className="block text-sm font-medium text-ink">
        Title
        <input className={field} value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} />
      </label>
      <label className="block text-sm font-medium text-ink">
        Summary
        <input className={field} value={summary} onChange={(event) => setSummary(event.target.value)} required maxLength={500} />
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
      <label className="block text-sm font-medium text-ink">
        Expected outcome
        <input
          className={field}
          value={expectedOutcome}
          onChange={(event) => setExpectedOutcome(event.target.value)}
          required
          maxLength={500}
        />
      </label>
      <label className="block text-sm font-medium text-ink">
        Kernel source
        <textarea
          className={`${field} font-mono text-xs`}
          rows={10}
          value={source}
          onChange={(event) => setSource(event.target.value)}
          required
        />
      </label>
      <label className="block text-sm font-medium text-ink">
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
        <p role="alert" className={errorText}>
          {error}
        </p>
      )}
      <div>
        <button type="submit" className={primaryButton} disabled={busy}>
          {busy ? "Adding…" : "Add example"}
        </button>
      </div>
    </form>
  );
}
