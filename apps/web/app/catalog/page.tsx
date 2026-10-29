import { Suspense } from "react";

import { CatalogPanel } from "../../src/features/catalog/CatalogPanel";
import { SiteShell } from "../../src/features/site/SiteShell";

export default function CatalogPage() {
  return (
    <SiteShell>
      <Suspense fallback={null}>
        <CatalogPanel />
      </Suspense>
    </SiteShell>
  );
}
