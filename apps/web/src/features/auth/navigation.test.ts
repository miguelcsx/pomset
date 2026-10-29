import { afterEach, describe, expect, it, vi } from "vitest";

import { afterSignInHref, authHref, safeNextPath } from "./navigation";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("safeNextPath", () => {
  it.each([
    ["/", "/"],
    ["/mis-scripts", "/mis-scripts"],
    ["/mis-scripts?page=2&pageSize=20", "/mis-scripts?page=2&pageSize=20"],
    ["/mis-scripts/abc-123", "/mis-scripts/abc-123"],
  ])("keeps the in-site path %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    ["protocol-relative", "//evil.example/path"],
    ["backslash after slash", "/\\evil.example"],
    ["absolute URL", "https://evil.example/"],
    ["javascript scheme", "javascript:alert(1)"],
    ["relative path", "mis-scripts"],
    ["encoded line break", "/ok\nLocation: /x"],
    ["tab", "/a\tb"],
    ["delete control", "/a\u007fb"],
    ["colon in query", "/mis-scripts?title=a:b"],
    ["empty", ""],
    ["missing", null],
    ["too long", `/${"a".repeat(600)}`],
    ["sends back to sign-in", "/login?next=%2F"],
    ["sends back to registration", "/register"],
  ])("refuses %s and falls back to /", (_label, input) => {
    expect(safeNextPath(input)).toBe("/");
  });
});

describe("authHref and afterSignInHref", () => {
  it("keeps the capability fragment and returns to a validated next", () => {
    expect(authHref("/login", "/mis-scripts?page=2", "#workbench=cap123")).toBe(
      "/login/?next=%2Fmis-scripts%3Fpage%3D2#workbench=cap123",
    );
    expect(afterSignInHref("//evil.example", "#workbench=cap123")).toBe("/#workbench=cap123");
  });

  it("omits a fragment when the page has none", () => {
    expect(authHref("/register", "/")).toBe("/register/?next=%2F");
    expect(afterSignInHref("/admin")).toBe("/admin");
  });
});
