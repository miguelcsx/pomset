import { Suspense } from "react";

import { AdminCatalogPanel } from "../../src/features/catalog/AdminCatalogPanel";
import { ProtectedRoute } from "../../src/features/auth/ProtectedRoute";
import { UsersTable } from "../../src/features/admin/UsersTable";
import { SiteShell } from "../../src/features/site/SiteShell";

export default function AdminPage() {
  return (
    <SiteShell>
      <ProtectedRoute role="admin">
        <Suspense fallback={null}>
          <UsersTable />
          <AdminCatalogPanel />
        </Suspense>
      </ProtectedRoute>
    </SiteShell>
  );
}
