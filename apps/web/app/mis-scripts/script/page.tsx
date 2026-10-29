"use client";

/**
 * One script, named by `?id=`. The id is read after mount: the export is a
 * single static page for every script, so nothing about it is known at build time.
 */

import { useEffect, useState } from "react";

import { ProtectedRoute } from "../../../src/features/auth/ProtectedRoute";
import { ScriptDetail } from "../../../src/features/scripts/ScriptDetail";
import { SiteShell } from "../../../src/features/site/SiteShell";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export default function ScriptPage() {
  const [id, setId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const value = new URLSearchParams(location.search).get("id");
    setId(value !== null && ID_PATTERN.test(value) ? value : null);
  }, []);

  return (
    <SiteShell>
      <ProtectedRoute>
        {id === undefined ? null : id === null ? (
          <p role="alert" className="text-sm text-danger">
            No script was named in this address.
          </p>
        ) : (
          <ScriptDetail id={id} />
        )}
      </ProtectedRoute>
    </SiteShell>
  );
}
