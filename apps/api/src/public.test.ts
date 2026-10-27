import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";

import { startWorkbench } from "./main.js";

const PUBLIC_HOST = "workbench.example.test";
const directory = mkdtempSync(join(tmpdir(), "pomset-public-test-"));
const token = randomBytes(32).toString("hex");
let server: Awaited<ReturnType<typeof startWorkbench>>;

beforeAll(async () => {
  server = await startWorkbench({ directory, port: 0, publicHost: PUBLIC_HOST, token });
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
): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { host: "127.0.0.1", port: server.port, method, path, headers },
      (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      },
    );
    req.on("error", reject);
    req.end();
  });
}

it("answers the public host over HTTPS origin and refuses every other name", async () => {
  const auth = { Authorization: `Bearer ${token}` };
  expect(await send("GET", "/api/workbench", { ...auth, Host: PUBLIC_HOST })).toBe(200);
  expect(
    await send("GET", "/api/workbench", { ...auth, Host: PUBLIC_HOST, Origin: `https://${PUBLIC_HOST}` }),
  ).toBe(200);
  expect(await send("GET", "/api/workbench", { ...auth, Host: "attacker.test" })).toBe(403);
  expect(await send("GET", "/api/workbench", { ...auth, Host: `127.0.0.1:${server.port}` })).toBe(403);
  expect(await send("GET", "/api/workbench", { ...auth, Host: PUBLIC_HOST, Origin: "http://" + PUBLIC_HOST })).toBe(403);
});

it("requires the same HTTPS origin for writes and the token for every API call", async () => {
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  expect(await send("GET", "/api/workbench", { Host: PUBLIC_HOST })).toBe(401);
  expect(await send("POST", "/api/analyses", { ...auth, Host: PUBLIC_HOST })).toBe(403);
  expect(
    await send("POST", "/api/analyses", { ...auth, Host: PUBLIC_HOST, Origin: "https://attacker.test" }),
  ).toBe(403);
  expect(
    await send("POST", "/api/analyses", { ...auth, Host: PUBLIC_HOST, Origin: `https://${PUBLIC_HOST}` }),
  ).not.toBe(403);
});

it("serves a health probe without the token, and prints no token in its URL", async () => {
  expect(await send("GET", "/healthz", { Host: PUBLIC_HOST })).toBe(200);
  expect(server.url).toBe(`https://${PUBLIC_HOST}/`);
  expect(server.url).not.toContain(token);
});

it("refuses a public workbench without a strong token", async () => {
  await expect(
    startWorkbench({ directory, port: 0, publicHost: PUBLIC_HOST, token: "short" }),
  ).rejects.toThrow(/POMSET_WORKBENCH_TOKEN/);
  await expect(startWorkbench({ directory, port: 0, publicHost: PUBLIC_HOST })).rejects.toThrow(
    /POMSET_WORKBENCH_TOKEN/,
  );
});
