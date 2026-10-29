/**
 * The accounts layer end to end: registration, sign-in, session tokens, roles,
 * script and result ownership, cascades, and the error boundary.
 *
 * Each request goes to a real server backed by a real SQLite file. A second
 * Prisma client reads and changes rows the way an operator would, so the
 * assertions check what was stored, not only what was answered.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  tooLarge,
  tooManyRequests,
  unauthenticated,
  unavailable,
} from "./domain/errors/ApplicationError.js";
import { passwordError } from "./domain/accounts/Account.js";
import { DEMO_ADMIN, DEMO_USER } from "./application/accounts/SeedDemoAccounts.js";
import { errorHandler } from "./interface/middlewares/error-handler.middleware.js";
import { openAccountsStore } from "./infrastructure/accounts/openAccountsStore.js";
import { startWorkbench, type RunningWorkbench } from "./main.js";

const ISSUER = "pomset-workbench";
const AUDIENCE = "pomset-workbench";
const JWT_SECRET = "accounts-test-secret-long-enough-for-hs256-signing";
const WRONG_SECRET = "a-different-secret-that-is-also-long-enough-to-matter";
const PASSWORD = "correct horse battery";
const ADMIN_PASSWORD = "demo administrator passphrase";
const USER_PASSWORD = "demo user passphrase";

interface Session {
  token: string;
  user: { id: string; email: string; displayName: string; role: string };
}

interface Failure {
  error: string;
  code: string;
  fields?: Record<string, string>;
}

interface CallOptions {
  method?: string;
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
}

const directory = mkdtempSync(join(tmpdir(), "pomset-accounts-test-"));
let server: RunningWorkbench;
let side: Awaited<ReturnType<typeof openAccountsStore>>;
let origin: string;
let capability: string;
let ada: Session;

beforeAll(async () => {
  server = await startWorkbench({
    directory,
    jwtSecret: JWT_SECRET,
    demoAccounts: { admin: ADMIN_PASSWORD, user: USER_PASSWORD },
  });
  origin = new URL(server.url).origin;
  capability = server.capability!;
  side = await openAccountsStore(join(directory, "accounts.sqlite"));
  ada = await register("ada@example.test", "Ada");
}, 30000);

afterAll(async () => {
  await side?.close();
  await server?.close();
  rmSync(directory, { recursive: true, force: true });
});

/** Every `/api` call carries the local capability; a session is added only when given. */
function call(path: string, options: CallOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {
    "X-Workbench-Token": capability,
    Origin: origin,
    ...options.headers,
  };
  if (options.token !== undefined) headers["Authorization"] = `Bearer ${options.token}`;
  const body = options.body === undefined ? undefined : JSON.stringify(options.body);
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(origin + path, {
    method: options.method ?? (body === undefined ? "GET" : "POST"),
    headers,
    ...(body === undefined ? {} : { body }),
  });
}

/** A successful response carries its payload under `data`, and nothing else is accepted. */
async function data<T>(response: Response): Promise<T> {
  const body = (await response.json()) as { data: T };
  expect(body).toHaveProperty("data");
  return body.data;
}

async function failure(response: Response): Promise<Failure> {
  return (await response.json()) as Failure;
}

function signIn(email: string, password: string): Promise<Response> {
  return call("/api/auth/login", { body: { email, password } });
}

async function register(email: string, displayName: string): Promise<Session> {
  const response = await call("/api/auth/register", { body: { email, password: PASSWORD, displayName } });
  expect(response.status).toBe(201);
  return data<Session>(response);
}

async function listScripts(token: string, query = "") {
  return data<{ items: { id: string; title: string }[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>(
    await call(`/api/scripts${query ? `?${query}` : ""}`, { token }),
  );
}

async function createScript(token: string, title: string, extra: Record<string, unknown> = {}) {
  const response = await call("/api/scripts", { token, body: { title, source: `# ${title}\n`, ...extra } });
  expect(response.status).toBe(201);
  return data<{ id: string; title: string }>(response);
}

it("registers an ordinary user, ignores a requested role, and stores only a bcrypt hash", async () => {
  const response = await call("/api/auth/register", {
    body: { email: "grace@example.test", password: PASSWORD, displayName: "Grace", role: "admin" },
  });
  expect(response.status).toBe(201);
  const text = await response.text();
  const session = JSON.parse(text).data as Session;
  expect(session.user.role).toBe("user");
  expect(text).not.toContain(PASSWORD);
  expect(text).not.toContain("passwordHash");

  const stored = await side.prisma.user.findUnique({ where: { email: "grace@example.test" } });
  expect(stored?.role).toBe("user");
  expect(stored?.passwordHash).toMatch(/^\$2[aby]\$12\$/);
});

it("refuses an email already registered, after normalizing its case", async () => {
  const response = await call("/api/auth/register", {
    body: { email: "ADA@example.test", password: PASSWORD, displayName: "Ada again" },
  });
  expect(response.status).toBe(409);
  expect((await failure(response)).code).toBe("conflict");
});

it("names every field that needs correcting, and creates nothing", async () => {
  const response = await call("/api/auth/register", {
    body: { email: "not-an-email", password: "short", displayName: "" },
  });
  expect(response.status).toBe(400);
  expect(Object.keys((await failure(response)).fields ?? {}).sort()).toEqual(["displayName", "email", "password"]);
  expect(await side.prisma.user.findUnique({ where: { email: "not-an-email" } })).toBeNull();
});

it("bounds passwords by bytes, because bcrypt ignores everything past 72", () => {
  expect(passwordError("short")).toBe("Use at least 8 characters");
  expect(passwordError("é".repeat(36))).toBeUndefined();
  expect(passwordError("é".repeat(37))).toBe("Use at most 72 bytes");
});

it("signs in with the right password, and answers a wrong password and an unknown email the same way", async () => {
  const good = await signIn("ada@example.test", PASSWORD);
  expect(good.status).toBe(200);
  expect((await data<Session>(good)).user.email).toBe("ada@example.test");

  const wrongPassword = await signIn("ada@example.test", "not the password");
  const unknownEmail = await signIn("nobody@example.test", PASSWORD);
  expect(wrongPassword.status).toBe(401);
  expect(unknownEmail.status).toBe(401);
  expect(await wrongPassword.text()).toBe(await unknownEmail.text());
});

it("returns the signed-in account, and refuses a missing or unreadable session", async () => {
  const me = await call("/api/auth/me", { token: ada.token });
  expect(me.status).toBe(200);
  expect((await data<Session["user"]>(me)).email).toBe("ada@example.test");
  expect((await call("/api/auth/me")).status).toBe(401);
  expect((await call("/api/auth/me", { token: "not-a-token" })).status).toBe(401);
  expect((await call("/api/auth/me", { headers: { Authorization: "Basic abc" } })).status).toBe(401);
});

it("refuses forged, unsigned, expired and foreign tokens, and accepts one signed correctly", async () => {
  const now = Math.floor(Date.now() / 1000);
  const subject = ada.user.id;
  const claims = { issuer: ISSUER, audience: AUDIENCE };
  const [header, payload, signature] = ada.token.split(".") as [string, string, string];
  const flipped = (signature[0] === "A" ? "B" : "A") + signature.slice(1);
  const unsigned = [
    Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify({ sub: subject, iss: ISSUER, aud: AUDIENCE, exp: now + 3600 })).toString("base64url"),
    "",
  ].join(".");

  const forgeries: Array<[string, string]> = [
    ["a changed signature", [header, payload, flipped].join(".")],
    ["an unsigned token", unsigned],
    [
      "a token signed with another secret",
      jwt.sign({}, WRONG_SECRET, { subject, algorithm: "HS256", expiresIn: "2h", ...claims }),
    ],
    [
      "a token signed with HS512 and the right secret",
      jwt.sign({}, JWT_SECRET, { subject, algorithm: "HS512", expiresIn: "2h", ...claims }),
    ],
    ["an expired token", jwt.sign({ exp: now - 60 }, JWT_SECRET, { subject, algorithm: "HS256", ...claims })],
    [
      "a token for another issuer",
      jwt.sign({}, JWT_SECRET, { subject, algorithm: "HS256", expiresIn: "2h", issuer: "someone-else", audience: AUDIENCE }),
    ],
    [
      "a token for another audience",
      jwt.sign({}, JWT_SECRET, { subject, algorithm: "HS256", expiresIn: "2h", issuer: ISSUER, audience: "someone-else" }),
    ],
  ];
  for (const [label, token] of forgeries) {
    const response = await call("/api/auth/me", { token });
    expect({ label, status: response.status }).toEqual({ label, status: 401 });
  }

  // The control: a token minted with the real secret and claims is accepted,
  // so each refusal above is about the defect it names.
  const genuine = jwt.sign({}, JWT_SECRET, { subject, algorithm: "HS256", expiresIn: "2h", ...claims });
  expect((await call("/api/auth/me", { token: genuine })).status).toBe(200);
});

it("refuses a session whose account has since been deleted", async () => {
  const gone = await register("gone@example.test", "Gone");
  expect((await call("/api/auth/me", { token: gone.token })).status).toBe(200);
  await side.prisma.user.delete({ where: { email: "gone@example.test" } });
  expect((await call("/api/auth/me", { token: gone.token })).status).toBe(401);
});

it("reads the role on every request, so a demotion takes effect on a live token", async () => {
  const promoted = await register("promoted@example.test", "Promoted");
  const listUsers = () => call("/api/admin/users", { token: promoted.token });
  expect((await listUsers()).status).toBe(403);

  await side.prisma.user.update({ where: { email: "promoted@example.test" }, data: { role: "admin" } });
  expect((await listUsers()).status).toBe(200);

  await side.prisma.user.update({ where: { email: "promoted@example.test" }, data: { role: "user" } });
  expect((await listUsers()).status).toBe(403);
});

it("lets only an administrator list accounts, and never shows a password hash", async () => {
  const admin = await data<Session>(await signIn(DEMO_ADMIN.email, ADMIN_PASSWORD));
  const listed = await call("/api/admin/users?pageSize=50", { token: admin.token });
  expect(listed.status).toBe(200);
  const text = await listed.text();
  expect(text).not.toContain("passwordHash");
  const page = JSON.parse(text).data as { items: { email: string }[] };
  expect(page.items.map((item) => item.email)).toContain(DEMO_USER.email);
  expect((await call("/api/admin/users?pageSize=500", { token: admin.token })).status).toBe(400);

  const user = await data<Session>(await signIn(DEMO_USER.email, USER_PASSWORD));
  const refused = await call("/api/admin/users", { token: user.token });
  expect(refused.status).toBe(403);
  expect((await failure(refused)).error).toBe("This page is for administrators");
  expect((await call("/api/admin/users")).status).toBe(401);
});

it("validates script input, and pages through the account's scripts", async () => {
  const refused = await call("/api/scripts", { token: ada.token, body: { title: "", source: 42 } });
  expect(refused.status).toBe(400);
  expect(Object.keys((await failure(refused)).fields ?? {}).sort()).toEqual(["source", "title"]);

  const tooBig = await call("/api/scripts", {
    token: ada.token,
    body: { title: "Big", source: "x", scenario: { blob: "x".repeat(64 * 1024) } },
  });
  expect(tooBig.status).toBe(400);
  expect(Object.keys((await failure(tooBig)).fields ?? {})).toEqual(["scenario"]);

  for (const query of ["page=0", "page=abc", "pageSize=51"])
    expect((await call(`/api/scripts?${query}`, { token: ada.token })).status).toBe(400);

  for (const title of ["Alpha", "Beta", "Gamma"]) await createScript(ada.token, title);
  const total = (await listScripts(ada.token)).pagination.total;
  expect(total).toBeGreaterThanOrEqual(3);
  const second = await listScripts(ada.token, "pageSize=2&page=2");
  expect(second.pagination).toEqual({ page: 2, pageSize: 2, total, totalPages: Math.ceil(total / 2) });
  expect(second.items).toHaveLength(Math.min(2, total - 2));
});

it("keeps scripts and their results private, and removes results with their script", async () => {
  const neighbour = await register("neighbour@example.test", "Neighbour");
  const script = await createScript(ada.token, "Private", { scenario: { kind: "grid" } });
  const path = `/api/scripts/${script.id}`;

  expect((await call(path, { token: neighbour.token })).status).toBe(404);
  expect((await call(path, { method: "PUT", token: neighbour.token, body: { title: "Stolen" } })).status).toBe(404);
  expect((await call(path, { method: "DELETE", token: neighbour.token })).status).toBe(404);
  expect((await call(`${path}/results`, { token: neighbour.token })).status).toBe(404);
  expect((await listScripts(neighbour.token)).items.map((item) => item.id)).not.toContain(script.id);

  const kept = await data<{ title: string; scenario: unknown }>(await call(path, { token: ada.token }));
  expect(kept.title).toBe("Private");
  expect(kept.scenario).toEqual({ kind: "grid" });

  // A saved result is written directly, so this test depends only on the rows the cascade removes.
  const result = await side.prisma.savedResult.create({
    data: {
      scriptId: script.id,
      analysisId: "job_private_1",
      job: JSON.stringify({ job: { jobId: "job_private_1" } }),
    },
  });
  const listed = await data<{ pagination: { total: number } }>(await call(`${path}/results`, { token: ada.token }));
  expect(listed.pagination.total).toBe(1);
  expect((await call(`${path}/results/${result.id}`, { token: neighbour.token })).status).toBe(404);
  expect((await call(`${path}/results/${result.id}`, { token: ada.token })).status).toBe(200);

  expect((await call(path, { method: "PUT", token: ada.token, body: {} })).status).toBe(400);
  expect((await call(path, { method: "DELETE", token: ada.token })).status).toBe(204);
  expect(await side.prisma.savedScript.findUnique({ where: { id: script.id } })).toBeNull();
  expect(await side.prisma.savedResult.count({ where: { scriptId: script.id } })).toBe(0);
});

it("answers a malformed body with a 400 that names the problem and no internals", async () => {
  const response = await fetch(origin + "/api/auth/login", {
    method: "POST",
    headers: { "X-Workbench-Token": capability, Origin: origin, "Content-Type": "application/json" },
    body: "{not json",
  });
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "The request body is not valid JSON", code: "bad_request" });
});

class RecordingResponse {
  code = 0;
  body: unknown = undefined;
  status(code: number): this {
    this.code = code;
    return this;
  }
  json(body: unknown): this {
    this.body = body;
    return this;
  }
}

/** Runs the error boundary on its own, so each branch is checked without a socket. */
function handled(error: unknown): RecordingResponse {
  const response = new RecordingResponse();
  errorHandler(error, {} as ExpressRequest, response as unknown as ExpressResponse, () => undefined);
  return response;
}

it("maps each kind of application error to its status and code", () => {
  const cases: Array<[unknown, number, string]> = [
    [badRequest("x"), 400, "bad_request"],
    [unauthenticated("x"), 401, "unauthenticated"],
    [forbidden("x"), 403, "forbidden"],
    [notFound("x"), 404, "not_found"],
    [conflict("x"), 409, "conflict"],
    [tooLarge("x"), 413, "too_large"],
    [tooManyRequests("x"), 429, "too_many_requests"],
    [unavailable("x"), 503, "unavailable"],
  ];
  for (const [error, status, code] of cases) {
    const sent = handled(error);
    expect({ status: sent.code, code: (sent.body as { code: string }).code }).toEqual({ status, code });
  }
  expect(handled(badRequest("Some fields need correcting", { fields: { email: "Enter a valid email address" } })).body).toEqual({
    error: "Some fields need correcting",
    code: "bad_request",
    fields: { email: "Enter a valid email address" },
  });
});

it("names the cause of a body-parser refusal by its type, not its text", () => {
  expect(handled(Object.assign(new Error("request entity too large"), { type: "entity.too.large" })).code).toBe(413);
  expect(handled(Object.assign(new SyntaxError("Unexpected token"), { type: "entity.parse.failed" })).code).toBe(400);
});

it("answers an unexpected failure with a generic message, and logs the cause", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const cause = new Error("ENOENT: /var/data/accounts.sqlite");
  const sent = handled(cause);
  expect(sent.code).toBe(500);
  expect(sent.body).toEqual({
    error: "Something went wrong on the server. Try again shortly.",
    code: "internal",
  });
  expect(JSON.stringify(sent.body)).not.toContain("accounts.sqlite");
  expect(log).toHaveBeenCalledWith(cause);
  log.mockRestore();
});
