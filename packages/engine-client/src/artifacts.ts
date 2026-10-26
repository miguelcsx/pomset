/** Local accounting is sampled; hosted quota enforcement belongs to the sandbox. */
import { lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { LimitBreach } from "./limits.js";

export function checkArtifactDirectory(root: string, allowed: number): number {
  let bytes = 0;
  let entries = 0;
  const visit = (path: string): void => {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory())) {
      throw new Error("Engine artifact directory contains a symlink or special file.");
    }
    if (++entries > 10000) throw new LimitBreach("maxArtifactEntries", entries, 10000);
    if (stat.isDirectory()) {
      for (const name of readdirSync(path)) visit(join(path, name));
    } else {
      bytes += stat.size;
      if (bytes > allowed) throw new LimitBreach("maxArtifactBytes", bytes, allowed);
    }
  };
  visit(root);
  return bytes;
}
