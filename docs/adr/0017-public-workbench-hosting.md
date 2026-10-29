# ADR-0017 Public workbench hosting

## Context

ADR-0013 made the workbench a single-owner loopback application, and ADR-0007
forbids a hosted web-to-local execution bridge. The owner now wants the same
workbench reachable at a public URL, deployed from `main` on Render's free web
plan, so a demo does not depend on the owner's machine being awake.

The workbench is still a symbolic application. The `full` operation runs the
Triton engine, which parses source and resolves constraints with Z3 and imports
or executes nothing. The OpenMP backend, which compiles and runs user kernels,
is not reachable from the API: `runSymbolic` never selects it, and the image
installs no `clang`. ADR-0016 and ADR-0013 keep that backend out of this surface.

Publishing the workbench moves the trust boundary from the owner's loopback
interface to the internet. The boundary is therefore amended here, and its
remaining weaknesses are recorded rather than hidden.

A single shared token cannot separate visitors: it gives every holder the same
saved scripts, the same results and the same administrator view. The public
workbench therefore has accounts.

## Decision

A workbench becomes public when it is given a hostname: either
`POMSET_WORKBENCH_PUBLIC_HOST`, or `RENDER_EXTERNAL_HOSTNAME`, which Render sets
on every web service. In that mode it:

- binds `0.0.0.0` on `PORT` (or `POMSET_WORKBENCH_PORT`), not loopback;
- accepts only that Host, and only the Origin `https://<host>` for writes;
- requires `JWT_SECRET`, at least 32 characters, and refuses to start without
  it;
- does not print the secret, any token or any URL containing a token, so Render's
  log stream does not hold them;
- answers `GET /healthz` without authentication or Host check, carrying no state.

Accounts are stored with Prisma on SQLite through the libSQL adapter, in
`accounts.sqlite` inside the data directory. The schema is in
`apps/api/prisma/accounts/schema.prisma`, and the migration in
`0001_accounts.sql` is reviewed SQL applied at start-up and tracked by
`PRAGMA user_version`. The rules that hold:

- Passwords are hashed with bcrypt at cost 12 and limited to 72 bytes, because
  bcrypt ignores anything after that. An unknown email is checked against a
  decoy hash, so the response time does not reveal which emails exist.
- Sign-in refusals use one message for an unknown email and a wrong password.
- Sessions are JWTs signed with HS256. Verification pins the algorithm, the
  issuer and the audience, and a session lasts two hours. The token's `sub` is
  the account id.
- The role is read from the database on every request, so a demoted or deleted
  account loses access at once, without waiting for its token to expire.
- Registration is limited to 10 per hour per address. Sign-in is limited to 30
  per 15 minutes per address and 10 per 15 minutes per email.
- Each account owns its saved scripts, the saved results of those scripts, and
  the analyses it started. Other accounts get `404`, not `403`, for records they
  do not own.
- Administrators can list users. Every other account gets `403`.
- Demo accounts are created only when `POMSET_DEMO_ACCOUNTS=1` and both demo
  passwords are set. Start-up never changes an existing account's password or
  role.

The browser keeps the session token in `sessionStorage`. It is cleared when the
tab closes, and it is sent only as `Authorization: Bearer`. Local use does not
use accounts: it keeps the loopback bind, a random per-run capability token
printed to the owner's terminal, and the `127.0.0.1` / `localhost` Host and
Origin pairs from ADR-0013.

The public workbench keeps the other controls of ADR-0013: `no-store`,
`nosniff`, `X-Frame-Options: DENY`, `no-referrer`, same-origin writes, a 3 MB
JSON limit, a 1 MB limit on each saved script, one analysis at a time, and the
30 s solver budget.

## Consequences

- Passwords and session tokens are the credentials. A stolen session token
  works until it expires, two hours at most. Since the token is in
  `sessionStorage`, any script that runs in the page can read it. The
  workbench renders analysis output as text, not HTML, which limits that risk.
- Storage is ephemeral. Render's free web service has no persistent disk, so
  accounts, saved scripts, saved results and analyses are lost on redeploy and
  may be lost when the service sleeps. Demo accounts come back at start-up
  because they are seeded again. Real accounts do not. This is acceptable for a
  demo and is not a store of record.
- Registration reveals whether an email is taken: a second registration with the
  same address returns `409 conflict`. This trades enumeration for a usable form,
  and it is the one place the sign-in message is not uniform.
- The free plan spins the service down after inactivity. The first request after
  a sleep waits for a cold start.
- The service runs as the unprivileged `node` user inside the container. The
  engine child processes inherit that user and the container's network.
- Transport security is Render's TLS. The workbench does not terminate TLS itself
  and trusts the `Host` header Render forwards, which the platform sets to the
  public hostname.
- Rotating `JWT_SECRET` in the Render dashboard signs every session out.

## Residual risks

- The rate limits are in memory and per process. They reset on every restart and
  assume one instance. Scaling out needs a shared store for the counters.
- No per-client rate limit covers the analysis route. A signed-in account can keep
  the single analysis slot busy for up to the solver budget.
- The Python engine is not sandboxed beyond its process boundary. The claim that
  it never imports or executes source is a property of the Triton engine, verified
  by tests and by review, not by a kernel-level sandbox. Adding user-kernel
  execution to this host requires a new ADR and its own isolation.
- Dependencies are pinned by the lockfile and `uv.lock`, but the base image is
  `node:22-bookworm-slim` and is not pinned by digest.

## Relation to other ADRs

ADR-0013 remains the decision for the local workbench and is amended for the
public deployment described here. ADR-0007, which forbids a hosted
web-to-local execution bridge, still holds: the public workbench executes
nothing from the browser on the owner's machine.
