/**
 * The catalog end to end over HTTP: reading is public, writing is the
 * administrator's, and a saved copy belongs to the account that saved it.
 *
 * Each request goes to a real server backed by a real SQLite file, so the
 * assertions check the stored rows and the answers together.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";

import { DEMO_ADMIN, DEMO_USER } from "./application/accounts/SeedDemoAccounts.js";
import { CATALOG_SEED } from "./infrastructure/accounts/catalogSeed.js";
import { startWorkbench, type RunningWorkbench } from "./main.js";

const JWT_SECRET = "catalog-test-secret-long-enough-for-hs256-signing";
const PASSWORD = "correct horse battery";
const ADMIN_PASSWORD = "demo administrator passphrase";
const USER_PASSWORD = "demo user passphrase";
const FLOOR = "cat_triton_transform_floor_grid";
const CEIL = "cat_triton_transform_ceil_grid";

interface Session {
  token: string;
  user: { id: string; email: string; displayName: string; role: string };
}

interface CallOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

const directory = mkdtempSync(join(tmpdir(), "pomset-catalog-test-"));
let server: RunningWorkbench;
let origin: string;
let capability: string;
let admin: Session;
let ada: Session;

beforeAll(async () => {
  server = await startWorkbench({
    directory,
    jwtSecret: JWT_SECRET,
    demoAccounts: { admin: ADMIN_PASSWORD, user: USER_PASSWORD },
  });
  origin = new URL(server.url).origin;
  capability = server.capability!;
  admin = await data<Session>(await call("/api/auth/login", { body: { email: DEMO_ADMIN.email, password: ADMIN_PASSWORD } }));
  const registered = await call("/api/auth/register", { body: { email: "ada@example.test", password: PASSWORD, displayName: "Ada" } });
  ada = await data<Session>(registered);
}, 30000);

afterAll(async () => {
  await server?.close();
  rmSync(directory, { recursive: true, force: true });
});

function call(path: string, options: CallOptions = {}): Promise<Response> {
  const headers: Record<string, string> = { "X-Workbench-Token": capability, Origin: origin };
  if (options.token !== undefined) headers["Authorization"] = `Bearer ${options.token}`;
  const body = options.body === undefined ? undefined : JSON.stringify(options.body);
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(origin + path, {
    method: options.method ?? (body === undefined ? "GET" : "POST"),
    headers,
    ...(body === undefined ? {} : { body }),
  });
}

/** A successful single resource carries its payload under `data`. */
async function data<T>(response: Response): Promise<T> {
  const body = (await response.json()) as { data: T };
  expect(body).toHaveProperty("data");
  return body.data;
}

/** The fields a create or update needs, taken from a reviewed seed so they are valid by construction. */
function validItem(overrides: Record<string, unknown> = {}) {
  const seed = CATALOG_SEED.find((item) => item.id === FLOOR)!;
  return {
    title: "Temporary example",
    summary: "A short description",
    kind: "control",
    source: seed.source,
    scenario: seed.scenario,
    expectedOutcome: "outputCoverage is established",
    ...overrides,
  };
}

it("lists the reviewed examples publicly, without their source or scenario", async () => {
  const response = await call("/api/catalog");
  expect(response.status).toBe(200);
  const body = (await response.json()) as { data: Record<string, unknown>[]; pagination: { total: number; page: number } };
  expect(body.pagination).toMatchObject({ page: 1, total: CATALOG_SEED.length });
  expect(body.data.map((item) => item["id"]).sort()).toEqual([CEIL, FLOOR].sort());
  for (const item of body.data) {
    expect(item).not.toHaveProperty("source");
    expect(item).not.toHaveProperty("scenario");
    expect(item).toHaveProperty("kind");
  }
});

it("returns one reviewed example in full, and refuses an unknown one", async () => {
  const seed = CATALOG_SEED.find((item) => item.id === FLOOR)!;
  const item = await data<{ id: string; kind: string; source: string; scenario: unknown; expectedOutcome: string }>(
    await call(`/api/catalog/${FLOOR}`),
  );
  expect(item).toMatchObject({ id: FLOOR, kind: "defect", source: seed.source, expectedOutcome: seed.expectedOutcome });
  expect(item.scenario).toEqual(seed.scenario);

  const missing = await call("/api/catalog/cat_does_not_exist");
  expect(missing.status).toBe(404);
});

it("refuses a catalog write without an account, and from a signed-in account that is not an administrator", async () => {
  expect((await call("/api/catalog", { body: validItem() })).status).toBe(401);
  expect((await call(`/api/catalog/${FLOOR}`, { method: "PUT", body: validItem() })).status).toBe(401);
  expect((await call(`/api/catalog/${FLOOR}`, { method: "DELETE" })).status).toBe(401);

  const user = await data<Session>(await call("/api/auth/login", { body: { email: DEMO_USER.email, password: USER_PASSWORD } }));
  expect((await call("/api/catalog", { token: user.token, body: validItem() })).status).toBe(403);
  expect((await call(`/api/catalog/${FLOOR}`, { method: "PUT", token: user.token, body: validItem() })).status).toBe(403);
  expect((await call(`/api/catalog/${FLOOR}`, { method: "DELETE", token: user.token })).status).toBe(403);
});

it("names every field a catalog write gets wrong, and creates nothing", async () => {
  const refused = await call("/api/catalog", {
    token: admin.token,
    body: validItem({ kind: "bogus", scenario: { notACanonicalScenario: true }, summary: "" }),
  });
  expect(refused.status).toBe(400);
  const body = (await refused.json()) as { fields: Record<string, string> };
  expect(Object.keys(body.fields).sort()).toEqual(["kind", "scenario", "summary"]);
  const listed = await call("/api/catalog");
  expect(((await listed.json()) as { pagination: { total: number } }).pagination.total).toBe(CATALOG_SEED.length);
});

it("lets an administrator create, change and remove an example", async () => {
  const created = await call("/api/catalog", { token: admin.token, body: validItem() });
  expect(created.status).toBe(201);
  const item = await data<{ id: string; title: string }>(created);

  const updated = await call(`/api/catalog/${item.id}`, {
    method: "PUT",
    token: admin.token,
    body: validItem({ title: "Renamed example" }),
  });
  expect(updated.status).toBe(200);
  expect((await data<{ title: string }>(updated)).title).toBe("Renamed example");

  expect((await call(`/api/catalog/${item.id}`, { method: "DELETE", token: admin.token })).status).toBe(204);
  expect((await call(`/api/catalog/${item.id}`)).status).toBe(404);
  expect((await call(`/api/catalog/${item.id}`, { method: "DELETE", token: admin.token })).status).toBe(404);
});

it("copies an example into the caller's scripts, and keeps the copy apart from the catalog", async () => {
  const seed = CATALOG_SEED.find((item) => item.id === CEIL)!;

  expect((await call(`/api/catalog/${CEIL}/scripts`, { method: "POST" })).status).toBe(401);

  const saved = await call(`/api/catalog/${CEIL}/scripts`, { method: "POST", token: ada.token });
  expect(saved.status).toBe(201);
  const script = await data<{ id: string; title: string; source: string; scenario: unknown; catalogItemId: string | null }>(saved);
  expect(script).toMatchObject({ title: seed.title, source: seed.source, catalogItemId: CEIL });
  expect(script.scenario).toEqual(seed.scenario);

  const renamed = await call(`/api/scripts/${script.id}`, { method: "PUT", token: ada.token, body: { title: "My variant" } });
  expect(renamed.status).toBe(200);
  const catalogCopy = await data<{ title: string }>(await call(`/api/catalog/${CEIL}`));
  expect(catalogCopy.title).toBe(seed.title);
});

it("keeps a saved copy when its catalog example is removed, and unlinks it", async () => {
  const item = await data<{ id: string }>(await call("/api/catalog", { token: admin.token, body: validItem({ title: "Short-lived" }) }));
  const saved = await data<{ id: string }>(await call(`/api/catalog/${item.id}/scripts`, { method: "POST", token: ada.token }));

  expect((await call(`/api/catalog/${item.id}`, { method: "DELETE", token: admin.token })).status).toBe(204);

  const kept = await data<{ title: string; catalogItemId: string | null; source: string }>(
    await call(`/api/scripts/${saved.id}`, { token: ada.token }),
  );
  expect(kept.catalogItemId).toBeNull();
  expect(kept.title).toBe("Short-lived");
  expect(kept.source.length).toBeGreaterThan(0);
});
