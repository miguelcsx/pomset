import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Session } from "../auth/account";
import { clearSession, currentSession, saveSession } from "../auth/session-store";
import { ApiError, apiRequest, unwrap } from "./http";

const session: Session = {
  token: "session-token-value",
  user: {
    id: "usr_1",
    email: "ada@example.org",
    displayName: "Ada",
    role: "user",
    createdAt: "2026-10-01T00:00:00.000Z",
  },
};

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    key: () => null,
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sentHeaders(fetchMock: ReturnType<typeof vi.fn>, call = 0): Record<string, string> {
  const init = fetchMock.mock.calls[call]?.[1] as RequestInit;
  return init.headers as Record<string, string>;
}

beforeEach(() => {
  vi.stubGlobal("sessionStorage", memoryStorage());
  vi.stubGlobal("location", { pathname: "/mis-scripts", search: "", hash: "" });
  clearSession();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("apiRequest headers", () => {
  it("sends the workbench capability on its own header, never in the URL", async () => {
    vi.stubGlobal("location", { pathname: "/", search: "", hash: "#workbench=cap-secret" });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: { ok: true } }));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/api/workbench");

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/workbench");
    expect(sentHeaders(fetchMock)["X-Workbench-Token"]).toBe("cap-secret");
    expect(sentHeaders(fetchMock)["Authorization"]).toBeUndefined();
  });

  it("sends the account token as a bearer header when signed in", async () => {
    saveSession(session);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/api/scripts", { auth: "required" });

    expect(sentHeaders(fetchMock)["Authorization"]).toBe(`Bearer ${session.token}`);
    expect(fetchMock.mock.calls[0]?.[0]).not.toContain(session.token);
  });

  it("refuses a required call locally when signed out, without calling the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/api/scripts", { auth: "required" })).rejects.toMatchObject({
      status: 401,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("apiRequest failures", () => {
  it("clears the stored session on a 401 for a signed-in call", async () => {
    saveSession(session);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(401, { error: "Sign in to continue" })),
    );

    const failure = await apiRequest("/api/scripts", { auth: "required" }).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ status: 401, message: "Sign in to continue" });
    expect(currentSession()).toBeNull();
    expect(sessionStorage.getItem("pomset.session")).toBeNull();
  });

  it("keeps the session when a public call is refused", async () => {
    saveSession(session);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(401, { error: "The email address or password is incorrect" })),
    );

    await expect(apiRequest("/api/auth/login", { method: "POST", body: {} })).rejects.toMatchObject({
      status: 401,
    });
    expect(currentSession()).toEqual(session);
  });

  it("carries field errors from a 400", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(400, {
          error: "Some fields need correcting",
          fields: { email: "This email address already has an account", bad: 3 },
        }),
      ),
    );

    const failure = await apiRequest("/api/auth/register", { body: {} }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({
      status: 400,
      fields: { email: "This email address already has an account" },
    });
  });

  it("uses a generic message when an error body is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>", { status: 502 })));

    await expect(apiRequest("/api/scripts")).rejects.toMatchObject({
      status: 502,
      message: "Request failed (502).",
    });
  });

  it("reports an unreachable server as status 0", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(apiRequest("/api/scripts")).rejects.toMatchObject({ status: 0 });
  });

  it("lets an aborted request propagate as an AbortError", async () => {
    const aborted = new DOMException("The operation was aborted.", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(aborted));

    await expect(apiRequest("/api/scripts")).rejects.toBe(aborted);
  });
});

describe("unwrap", () => {
  it("returns the data of an envelope and refuses anything else", () => {
    expect(unwrap({ data: { id: 1 } })).toEqual({ id: 1 });
    expect(() => unwrap({ error: "nope" })).toThrow("Invalid response envelope");
  });
});
