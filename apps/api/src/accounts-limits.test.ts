/**
 * The attempt limits on registration and sign-in. Each server keeps its own
 * counts, so this file starts its own server rather than sharing the accounts
 * suite's, whose registrations would use up the allowance first.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";

import { startWorkbench, type RunningWorkbench } from "./main.js";

const PASSWORD = "correct horse battery";
const directory = mkdtempSync(join(tmpdir(), "pomset-limits-test-"));
const SLOW = 60000;
let server: RunningWorkbench;
let origin: string;

beforeAll(async () => {
  server = await startWorkbench({ directory, jwtSecret: "limits-test-secret-long-enough-for-hs256-signing" });
  origin = new URL(server.url).origin;
}, 30000);

afterAll(async () => {
  await server?.close();
  rmSync(directory, { recursive: true, force: true });
});

function call(path: string, body: unknown): Promise<Response> {
  return fetch(origin + path, {
    method: "POST",
    headers: {
      "X-Workbench-Token": server.capability!,
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function refusalCode(response: Response): Promise<string> {
  return ((await response.json()) as { code: string }).code;
}

it(
  "stops registrations from one address after ten in an hour",
  async () => {
    for (let index = 1; index <= 10; index++) {
      const response = await call("/api/auth/register", {
        email: `limit${index}@example.test`,
        password: PASSWORD,
        displayName: `Limit ${index}`,
      });
      expect(response.status).toBe(201);
    }
    const refused = await call("/api/auth/register", {
      email: "limit11@example.test",
      password: PASSWORD,
      displayName: "Limit 11",
    });
    expect(refused.status).toBe(429);
    expect(await refusalCode(refused)).toBe("too_many_requests");
  },
  SLOW,
);

it(
  "stops guessing one account after ten attempts, even when the eleventh has the right password",
  async () => {
    for (let index = 1; index <= 10; index++) {
      const response = await call("/api/auth/login", { email: "limit1@example.test", password: `guess ${index}` });
      expect(response.status).toBe(401);
    }
    const correct = await call("/api/auth/login", { email: "limit1@example.test", password: PASSWORD });
    expect(correct.status).toBe(429);
    expect(await refusalCode(correct)).toBe("too_many_requests");
  },
  SLOW,
);
