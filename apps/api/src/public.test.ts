import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";

import { startWorkbench } from "./main.js";

const PUBLIC_HOST = "workbench.example.test";
const PASSWORD = "correct horse battery";
const directory = mkdtempSync(join(tmpdir(), "pomset-public-test-"));
const jwtSecret = randomBytes(32).toString("hex");
let server: Awaited<ReturnType<typeof startWorkbench>>;

beforeAll(async () => {
  server = await startWorkbench({ directory, port: 0, publicHost: PUBLIC_HOST, jwtSecret });
}, 20000);

afterAll(async () => {
  await server?.close();
  rmSync(directory, { recursive: true, force: true });
});

/** Sends a request to the socket with an explicit Host, which `fetch` will not set. */
function send(
  method: string,
  path: string,
  headers: Record<string, string>,
  body?: unknown,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { host: "127.0.0.1", port: server.port, method, path, headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
      },
    );
    req.on("error", reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

it("answers the public host over HTTPS origin and refuses every other name", async () => {
  expect((await send("GET", "/api/workbench", { Host: PUBLIC_HOST }, undefined)).status).toBe(200);
  expect(
    (await send("GET", "/api/workbench", { Host: PUBLIC_HOST, Origin: `https://${PUBLIC_HOST}` }, undefined)).status,
  ).toBe(200);
  expect((await send("GET", "/api/workbench", { Host: "attacker.test" }, undefined)).status).toBe(403);
  expect((await send("GET", "/api/workbench", { Host: `127.0.0.1:${server.port}` }, undefined)).status).toBe(403);
  expect(
    (await send("GET", "/api/workbench", { Host: PUBLIC_HOST, Origin: "http://" + PUBLIC_HOST }, undefined)).status,
  ).toBe(403);
});

it("issues no local capability, and requires an account for analyses", async () => {
  expect(server.capability).toBeUndefined();
  expect((await send("POST", "/api/analyses", { Host: PUBLIC_HOST, "Content-Type": "application/json" }, {})).status).toBe(403);
  expect(
    (await send(
      "POST",
      "/api/analyses",
      { Host: PUBLIC_HOST, Origin: `https://${PUBLIC_HOST}`, "Content-Type": "application/json" },
      {},
    )).status,
  ).toBe(401);
  expect((await send("GET", "/api/analyses/job_missing", { Host: PUBLIC_HOST }, undefined)).status).toBe(401);
});

it("registers an account over the public origin and signs it in", async () => {
  const origin = { Host: PUBLIC_HOST, Origin: `https://${PUBLIC_HOST}`, "Content-Type": "application/json" };
  const registered = await send("POST", "/api/auth/register", origin, {
    email: "visitor@example.test",
    password: PASSWORD,
    displayName: "Visitor",
  });
  expect(registered.status).toBe(201);
  const { data } = JSON.parse(registered.body) as { data: { token: string; user: { role: string } } };
  expect(data.user.role).toBe("user");

  const me = await send("GET", "/api/auth/me", { Host: PUBLIC_HOST, Authorization: `Bearer ${data.token}` }, undefined);
  expect(me.status).toBe(200);
  expect(me.body).not.toContain("passwordHash");

  const cross = await send(
    "POST",
    "/api/auth/login",
    { ...origin, Origin: "https://attacker.test" },
    { email: "visitor@example.test", password: PASSWORD },
  );
  expect(cross.status).toBe(403);
});

it("lists no analysis to an anonymous caller, and only the caller's own to a signed-in one", async () => {
  const origin = { Host: PUBLIC_HOST, Origin: `https://${PUBLIC_HOST}`, "Content-Type": "application/json" };
  const registered = await send("POST", "/api/auth/register", origin, {
    email: "history@example.test",
    password: PASSWORD,
    displayName: "History",
  });
  const { data } = JSON.parse(registered.body) as { data: { token: string } };

  const anonymous = await send("GET", "/api/workbench", { Host: PUBLIC_HOST }, undefined);
  expect(anonymous.status).toBe(200);
  expect((JSON.parse(anonymous.body) as { data: { jobs: unknown[] } }).data.jobs).toEqual([]);

  const signedIn = await send(
    "GET",
    "/api/workbench",
    { Host: PUBLIC_HOST, Authorization: `Bearer ${data.token}` },
    undefined,
  );
  expect(signedIn.status).toBe(200);
  expect((JSON.parse(signedIn.body) as { data: { jobs: unknown[] } }).data.jobs).toEqual([]);

  const stale = await send("GET", "/api/workbench", { Host: PUBLIC_HOST, Authorization: "Bearer not-a-token" }, undefined);
  expect(stale.status).toBe(200);

  expect((await send("GET", "/api/analyses", { Host: PUBLIC_HOST }, undefined)).status).toBe(401);
  const mine = await send("GET", "/api/analyses", { Host: PUBLIC_HOST, Authorization: `Bearer ${data.token}` }, undefined);
  expect(mine.status).toBe(200);
  expect((JSON.parse(mine.body) as { data: unknown[] }).data).toEqual([]);
});

it("serves a health probe without any credential, and prints no secret in its URL", async () => {
  expect((await send("GET", "/healthz", { Host: PUBLIC_HOST }, undefined)).status).toBe(200);
  expect(server.url).toBe(`https://${PUBLIC_HOST}/`);
  expect(server.url).not.toContain(jwtSecret);
});

it("refuses a public workbench without a strong JWT secret", async () => {
  await expect(
    startWorkbench({ directory, port: 0, publicHost: PUBLIC_HOST, jwtSecret: "short" }),
  ).rejects.toThrow(/JWT_SECRET/);
  await expect(startWorkbench({ directory, port: 0, publicHost: PUBLIC_HOST })).rejects.toThrow(
    /JWT_SECRET/,
  );
});
