/** Explicit local symbolic workbench. This is not the read-only CLI viewer or a hosted deployment. */
import express from "express";
import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import { AnalysisService } from "./analysis-service.js";
import { REPO_ROOT } from "@pomset/worker";
export async function startWorkbench(options: { directory: string; port?: number }) {
  const service = new AnalysisService(options.directory);
  const token = randomBytes(32).toString("hex");
  const app = express();
  app.disable("x-powered-by");
  let port = options.port ?? 0;
  app.use((request, response, next) => {
    const host = request.headers.host;
    const origin = request.headers.origin;
    if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(host ?? "") || origin && origin !== `http://${host}`) { response.status(403).json({ error: "Forbidden host or origin" }); return; }
    response.set({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer", "Cross-Origin-Resource-Policy": "same-origin" });
    next();
  });
  app.use("/api", (request, response, next) => {
    const supplied = Buffer.from(request.headers.authorization?.replace(/^Bearer /, "") ?? "");
    if (supplied.length !== token.length || !timingSafeEqual(supplied, Buffer.from(token))) { response.status(401).json({ error: "Open the workbench URL printed by its local server to authorize this browser." }); return; }
    if (!["GET", "HEAD"].includes(request.method) && request.headers.origin !== `http://${request.headers.host}`) { response.status(403).json({ error: "Same-origin analysis requests are required" }); return; }
    next();
  });
  app.use("/api", express.json({ limit: "2mb", strict: true }));
  app.get("/api/workbench", (_request, response) => {
    try { response.json({ mode: "local-symbolic", profile: service.profile(), maxSolverTimeMs: 30000, jobs: service.history(), unavailable: [
      { backend: "cuda", reason: "CUDA adapter and toolkit conformance are not available in this workbench. Compilation itself does not require a GPU." },
      { backend: "openmp", reason: "User-kernel adapter is not implemented. OpenMP compilation and execution use a CPU." },
    ] }); } catch (error) { response.status(503).json({ error: error instanceof Error ? error.message : String(error) }); }
  });
  app.post("/api/analyses", (request, response, next) => { try { response.status(202).json(service.submit(request.body)); } catch (error) { next(error); } });
  app.get("/api/analyses/:id", (request, response, next) => { try { response.json(service.report(request.params["id"]!)); } catch (error) { next(error); } });
  app.post("/api/analyses/:id/cancel", (request, response, next) => { try { response.json(service.cancel(request.params["id"]!)); } catch (error) { next(error); } });
  app.use("/api", (_request, response) => { response.status(404).json({ error: "No such workbench operation" }); });
  app.use(express.static(join(REPO_ROOT, "apps/web/dist"), { index: "index.html", dotfiles: "deny" }));
  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.startsWith("PROFILE_NOT_FOUND") ? 404 : message.startsWith("INPUT_INVALID") || error instanceof SyntaxError ? 400 : (error as { status?: number }).status === 413 ? 413 : 500;
    response.status(status).json({ error: message });
  });
  const server = createServer(app);
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  try { await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); }); } catch (error) { await service.close(); throw error; }
  const address = server.address();
  if (address && typeof address === "object") port = address.port;
  return { url: `http://127.0.0.1:${port}/#workbench=${token}`, token, service,
    async close() { await service.close(); await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); } };
}
