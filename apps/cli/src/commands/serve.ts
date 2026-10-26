/** Loopback-only static workbench plus capability-gated, read-only report data. */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { existsSync, lstatSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { REPO_ROOT } from "../engine.js";

export interface ServeOptions { readonly reportPath?: string; readonly port?: number; readonly host?: string; }
export interface ServedReport { readonly url: string; readonly capability: string; close(): Promise<void>; }
const LOOPBACK = "127.0.0.1";
export const ROUTES = ["/", "/api/report"] as const;

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8", js: "text/javascript", css: "text/css",
  json: "application/json", txt: "text/plain; charset=utf-8", svg: "image/svg+xml",
  png: "image/png", jpg: "image/jpeg", ico: "image/x-icon", woff2: "font/woff2", ttf: "font/ttf",
};

/**
 * Resolves a request path inside the exported client. The path is never taken
 * as a host path: it must stay under `webRoot`, and a symlink is refused rather
 * than followed. The exported client is a plain static tree, so its own layout
 * — `index.html`, `_next/static/…` — is served as it was written.
 */
function exportedFile(webRoot: string, pathname: string): { path: string; type: string } | undefined {
  let decoded: string;
  try { decoded = decodeURIComponent(pathname); } catch { return undefined; }
  if (decoded.includes("\0") || decoded.includes("..")) return undefined;
  const path = join(webRoot, decoded === "/" ? "index.html" : decoded);
  const inside = relative(webRoot, path);
  if (inside.startsWith("..") || inside.includes(`..${sep}`) || !inside) return undefined;
  if (!existsSync(path) || !statSync(path).isFile() || lstatSync(path).isSymbolicLink()) return undefined;
  const extension = path.split(".").at(-1)?.toLowerCase() ?? "";
  return { path, type: TYPES[extension] ?? "application/octet-stream" };
}

function send(response: ServerResponse, status: number, type: string, body: string | Uint8Array): void {
  response.writeHead(status, { "content-type": type, "cache-control": "no-store", "cross-origin-resource-policy": "same-origin",
    "x-content-type-options": "nosniff", "x-frame-options": "DENY", "referrer-policy": "no-referrer" });
  response.end(body);
}
function hostAllowed(request: IncomingMessage, port: number): boolean {
  const peer = request.socket.remoteAddress;
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(peer ?? "") &&
    [`${LOOPBACK}:${port}`, `localhost:${port}`].includes(request.headers.host ?? "");
}
export async function serve(options: ServeOptions): Promise<ServedReport> {
  if (options.host && options.host !== LOOPBACK) throw new Error("INPUT_INVALID: the local viewer binds only to 127.0.0.1");
  const requestedPort = options.port ?? 8787;
  if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) throw new Error("INPUT_INVALID: invalid loopback port");
  const webRoot = join(REPO_ROOT, "apps/web/out");
  if (!existsSync(join(webRoot, "index.html"))) throw new Error("INPUT_INVALID: built workbench missing; run pnpm build");
  const report = options.reportPath ? readFileSync(options.reportPath) : Buffer.from("null");
  if (report.byteLength > 16_777_216) throw new Error("INPUT_INVALID: report exceeds the viewer byte limit");
  JSON.parse(report.toString("utf8"));
  const capability = randomBytes(24).toString("hex");
  let port = requestedPort;
  const server = createServer((request, response) => {
    const origin = request.headers.origin;
    if (!hostAllowed(request, port) || origin && origin !== `http://${request.headers.host}`) { send(response, 403, "text/plain", "forbidden host, peer or origin\n"); return; }
    if (request.method !== "GET" && request.method !== "HEAD") { send(response, 405, "text/plain", "read-only transport\n"); return; }
    const url = new URL(request.url ?? "/", `http://${LOOPBACK}:${port}`);
    if (url.pathname === "/api/report") {
      if (url.searchParams.get("capability") !== capability) { send(response, 403, "text/plain", "a local read capability is required\n"); return; }
      send(response, 200, "application/json", report);
      return;
    }
    const file = exportedFile(webRoot, url.pathname);
    if (file) { send(response, 200, file.type, readFileSync(file.path)); return; }
    send(response, 404, "text/plain", "not found\n");
  });
  await new Promise<void>((ready, reject) => { server.once("error", reject); server.listen(requestedPort, LOOPBACK, ready); });
  const address = server.address();
  if (address && typeof address === "object") port = address.port;
  return { url: `http://${LOOPBACK}:${port}/#capability=${capability}`, capability,
    close: () => new Promise<void>((closed) => server.close(() => closed())) };
}
