import { LoginForm } from "../../src/features/auth/LoginForm";
import { heading } from "../../src/features/ui/classes";
import { SiteShell } from "../../src/features/site/SiteShell";

export default function LoginPage() {
  return (
    <SiteShell compact>
      <section aria-labelledby="login-title" className="mx-auto max-w-md">
        <h1 id="login-title" className={heading}>
          Sign in
        </h1>
        <LoginForm />
      </section>
    </SiteShell>
  );
}
