import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { supervise } from "./supervise.js";
import { DEFAULT_BUDGET } from "./request.js";
import { checkArtifactDirectory } from "./artifacts.js";

const hello = JSON.stringify({ protocolVersion: 1, jobId: "job_test", attemptId: "att_test", sequence: 1, type: "hello", payload: { engineName: "test", engineVersion: "1", capabilities: [] } });
const launch = (source: string) => spawn(process.execPath, ["-e", source], { detached: true, stdio: ["pipe", "pipe", "pipe"] });
describe("real supervisor resource and cancellation boundaries", () => {
  it("counts whitespace output against the total byte budget", async () => {
    const child = launch(`process.stdout.write(${JSON.stringify(hello + "\n")}); process.stdout.write(" ".repeat(900)+"\\n".repeat(200));`);
    const run = await supervise({ child, jobId: "job_test", attemptId: "att_test", limits: { ...DEFAULT_BUDGET, maxOutputBytes: 1000 } });
    expect(run.terminal).toBe("error");
    expect(run.error?.details?.["limit"]).toBe("maxOutputBytes");
  });
  it("gives a cooperative engine the cancel envelope without immediately signalling it", async () => {
    const controller = new AbortController();
    const child = launch(`process.stdout.write(${JSON.stringify(hello + "\n")}); process.on("SIGTERM",()=>process.stderr.write("unexpected signal")); process.stdin.once("data",data=>{process.stderr.write(JSON.parse(data).type);process.exit(0)});`);
    const run = await supervise({ child, jobId: "job_test", attemptId: "att_test", limits: DEFAULT_BUDGET, signal: controller.signal, onChunk: () => controller.abort() });
    expect(run.cancelled).toBe(true);
    expect(run.diagnostics.join("")).toBe("cancel");
    expect(run.redactionRevision).toBe("2");
  });
  it("escalates cancellation when an engine ignores stdin", async () => {
    const controller = new AbortController();
    const child = launch(`process.stdout.write(${JSON.stringify(hello + "\n")}); setInterval(()=>{},1000);`);
    const run = await supervise({ child, jobId: "job_test", attemptId: "att_test", limits: DEFAULT_BUDGET, signal: controller.signal, onChunk: () => controller.abort() });
    expect(run.cancelled).toBe(true);
    expect(child.signalCode).toBe("SIGKILL");
  });
  it("accounts actual files including undeclared artifacts and rejects symlinks", () => {
    const directory = mkdtempSync(join(tmpdir(), "pomset-artifacts-"));
    writeFileSync(join(directory, "unannounced.bin"), Buffer.alloc(20));
    expect(checkArtifactDirectory(directory, 20)).toBe(20);
    expect(() => checkArtifactDirectory(directory, 19)).toThrow("maxArtifactBytes");
    symlinkSync("/tmp", join(directory, "escape"));
    expect(() => checkArtifactDirectory(directory, 100)).toThrow("symlink");
  });
});
