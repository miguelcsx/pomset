import { ProtectedRoute } from "../../src/features/auth/ProtectedRoute";
import { ScriptsPanel } from "../../src/features/scripts/ScriptsPanel";
import { SiteShell } from "../../src/features/site/SiteShell";

export default function MyScriptsPage() {
  return (
    <SiteShell>
      <ProtectedRoute>
        <ScriptsPanel />
      </ProtectedRoute>
    </SiteShell>
  );
}
