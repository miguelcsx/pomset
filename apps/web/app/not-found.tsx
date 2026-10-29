import Link from "next/link";

import { SiteShell } from "../src/features/site/SiteShell";
import { heading, linkButton } from "../src/features/ui/classes";

export default function NotFound() {
  return (
    <SiteShell>
      <h1 className={heading}>Page not found</h1>
      <p className="mt-3 text-sm text-muted">
        <Link className={linkButton} href="/">
          Go to the workbench
        </Link>
      </p>
    </SiteShell>
  );
}
