"use client";

/**
 * One catalog example, named by `?id=`. A signed-in account can save a copy to
 * its scripts; anyone else is sent to sign in and back here.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { failureMessage } from "../common/http";
import { useBrowserLocation } from "../auth/use-browser-location";
import { authHref, currentPath } from "../auth/navigation";
import { useSession } from "../auth/use-session";
import { usableScenario } from "../scenario/scenario-draft";
import { stageDraft } from "../workspace/workspace-persistence";
import { badge, errorText, heading, lead, linkButton, panel, primaryButton, secondaryButton } from "../ui/classes";
import { getCatalogItem, kindLabel, type CatalogItem, saveCatalogItem } from "./catalog-api";

export function CatalogItemView({ id }: { readonly id: string }) {
  const router = useRouter();
  const here = useBrowserLocation();
  const state = useSession();
  const [item, setItem] = useState<CatalogItem>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();

  useEffect(() => {
    let live = true;
    getCatalogItem(id)
      .then((value) => {
        if (live) setItem(value);
      })
      .catch((failure: unknown) => {
        if (live) setError(failureMessage(failure));
      });
    return () => {
      live = false;
    };
  }, [id]);

  if (error) {
    return (
      <p role="alert" className={errorText}>
        {error}
      </p>
    );
  }
  if (!item) return null;

  async function openInWorkbench(example: CatalogItem) {
    const scenario = usableScenario(example.scenario);
    if (!scenario) {
      setSaveError("This example does not carry a scenario the analysis can run.");
      return;
    }
    try {
      await stageDraft(scenario.entrypoint.path, example.source, scenario);
      router.push(`/${here.fragment}`);
    } catch (failure) {
      setSaveError(failureMessage(failure));
    }
  }

  async function save() {
    setSaving(true);
    setSaveError(undefined);
    try {
      const copy = await saveCatalogItem(id);
      router.push(`/mis-scripts/script/?id=${encodeURIComponent(copy.id)}${here.fragment}`);
    } catch (failure) {
      setSaveError(failureMessage(failure));
    } finally {
      setSaving(false);
    }
  }

  return (
    <article aria-labelledby="item-title" className="space-y-6">
      <header>
        <span className={badge}>{kindLabel(item.kind)}</span>
        <h1 id="item-title" className={`${heading} mt-3`}>
          {item.title}
        </h1>
        <p className={lead}>{item.summary}</p>
      </header>

      <section className={`${panel} p-4`} aria-labelledby="outcome-title">
        <h2 id="outcome-title" className="text-sm font-semibold text-ink">
          Expected outcome
        </h2>
        <p className="mt-2 font-mono text-xs text-ink">{item.expectedOutcome}</p>
      </section>

      <section aria-labelledby="source-title">
        <h2 id="source-title" className="text-sm font-semibold text-ink">
          Kernel source
        </h2>
        <pre className={`${panel} mt-2 overflow-x-auto p-4 font-mono text-xs text-ink`}>{item.source}</pre>
      </section>

      <section aria-labelledby="scenario-title">
        <h2 id="scenario-title" className="text-sm font-semibold text-ink">
          Scenario
        </h2>
        <pre className={`${panel} mt-2 overflow-x-auto p-4 font-mono text-xs text-ink`}>
          {JSON.stringify(item.scenario, null, 2)}
        </pre>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={primaryButton} onClick={() => void openInWorkbench(item)}>
          Open in workbench
        </button>
        {state.status === "signed-in" && (
          <button type="button" className={secondaryButton} onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save as my script"}
          </button>
        )}
        {state.status === "signed-out" && (
          <Link className={linkButton} href={authHref("/login", currentPath(), here.fragment)}>
            Sign in to save a copy to your scripts
          </Link>
        )}
        <Link className={linkButton} href={`/catalog/${here.fragment}`}>
          Back to the catalog
        </Link>
      </div>
      {saveError && (
        <p role="alert" className={errorText}>
          {saveError}
        </p>
      )}
    </article>
  );
}
