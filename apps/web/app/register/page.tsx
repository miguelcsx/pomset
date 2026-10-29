import { RegisterForm } from "../../src/features/auth/RegisterForm";
import { heading } from "../../src/features/ui/classes";
import { SiteShell } from "../../src/features/site/SiteShell";

export default function RegisterPage() {
  return (
    <SiteShell compact>
      <section aria-labelledby="register-title" className="mx-auto max-w-md">
        <h1 id="register-title" className={heading}>
          Create account
        </h1>
        <RegisterForm />
      </section>
    </SiteShell>
  );
}
