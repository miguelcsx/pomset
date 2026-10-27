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

## Decision

A workbench becomes public when it is given a hostname: either
`POMSET_WORKBENCH_PUBLIC_HOST`, or `RENDER_EXTERNAL_HOSTNAME`, which Render sets
on every web service. In that mode it:

- binds `0.0.0.0` on `PORT` (or `POMSET_WORKBENCH_PORT`), not loopback;
- accepts only that Host, and only the Origin `https://<host>` for writes;
- requires `POMSET_WORKBENCH_TOKEN`, at least 32 characters, and refuses to start
  without it; it never mints a token of its own;
- does not print the token or any URL containing it, so Render's log stream
  does not hold it;
- answers `GET /healthz` without a token or Host check, carrying no state.

Local use is unchanged: loopback bind, a random per-run token printed to the
owner's terminal, and the `127.0.0.1` / `localhost` Host and Origin pairs.

The public workbench keeps every other control of ADR-0013: bearer token on
`/api`, constant-time comparison, `no-store`, `nosniff`, `X-Frame-Options: DENY`,
`no-referrer`, same-origin writes, the 2 MB JSON limit, the 1 MB per-file limit,
one analysis at a time, and the 30 s solver budget.

## Consequences

- The token is the only credential. Anyone who holds the URL fragment can read
  and submit analyses. Share it out of band, and rotate it in the Render
  dashboard by changing `POMSET_WORKBENCH_TOKEN` and redeploying.
- Storage is ephemeral. Render's free web service has no persistent disk, so
  analyses are lost on redeploy and may be lost when the service sleeps. This is
  acceptable for a demo and is not a store of record.
- The free plan spins the service down after inactivity. The first request after
  a sleep waits for a cold start.
- The service runs as the unprivileged `node` user inside the container. The
  engine child processes inherit that user and the container's network.
- Transport security is Render's TLS. The workbench does not terminate TLS itself
  and trusts the `Host` header Render forwards, which the platform sets to the
  public hostname.

## Residual risks

- No per-client rate limit. The token gates every route, so unauthenticated
  traffic is refused cheaply, but a holder of the token can keep the single
  analysis slot busy for up to the solver budget.
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
