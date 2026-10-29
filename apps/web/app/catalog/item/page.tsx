"use client";

/**
 * One catalog example, named by `?id=`. Like the script page, the id is read
 * after mount because the export is a single static page for every example.
 */

import { useEffect, useState } from "react";

import { CatalogItemView } from "../../../src/features/catalog/CatalogItemView";
import { SiteShell } from "../../../src/features/site/SiteShell";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export default function CatalogItemPage() {
  const [id, setId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const value = new URLSearchParams(location.search).get("id");
    setId(value !== null && ID_PATTERN.test(value) ? value : null);
  }, []);

  return (
    <SiteShell>
      {id === undefined ? null : id === null ? (
        <p role="alert" className="text-sm text-danger">
          No catalog example was named in this address.
        </p>
      ) : (
        <CatalogItemView id={id} />
      )}
    </SiteShell>
  );
}
