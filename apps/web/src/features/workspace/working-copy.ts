/** Drafts carry no results. Their captured base remains immutable and separately readable. */
import type { InspectionDocument } from "@pomset/ui";
export interface WorkingFile { readonly path: string; readonly source: string; }
export interface WorkingCopy { readonly id: string; readonly files: readonly WorkingFile[]; readonly baseResultId?: string; readonly baseSnapshotId?: string; }
export const MAX_SOURCE_BYTES = 1_048_576;
export function forkReport(document: InspectionDocument): WorkingCopy {
  return { id: crypto.randomUUID(), baseResultId: document.analysis.resultId, baseSnapshotId: document.snapshot.snapshotId,
    files: document.snapshot.files.map((file) => ({ path: file.path, source: new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(atob(document.sourceFiles[file.path]!.data), (char) => char.charCodeAt(0))) })) };
}
export function editWorkingFile(copy: WorkingCopy, path: string, source: string): WorkingCopy {
  if (!copy.files.some((file) => file.path === path)) throw new Error("Working file does not exist.");
  if (new TextEncoder().encode(source).byteLength > MAX_SOURCE_BYTES) throw new Error("Source exceeds the one-megabyte editor limit.");
  return { ...copy, files: copy.files.map((file) => file.path === path ? { ...file, source } : file) };
}
export function downloadText(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
