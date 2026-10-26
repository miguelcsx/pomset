import { describe, expect, it } from "vitest";
import { editWorkingFile, MAX_SOURCE_BYTES } from "./working-copy";
describe("interactive working copies", () => {
  it("edits a named file without changing its immutable base or other working files", () => {
    const original = { id: "copy_test", baseSnapshotId: "snp_base", files: [{ path: "kernel.py", source: "before" }, { path: "reference.py", source: "reference" }] };
    const edited = editWorkingFile(original, "kernel.py", "after");
    expect(edited.files[0]?.source).toBe("after");
    expect(edited.files[1]).toEqual(original.files[1]);
    expect(original.files[0]?.source).toBe("before");
    expect(edited.baseSnapshotId).toBe("snp_base");
  });
  it("refuses an unknown file and oversized edits instead of changing another file", () => {
    const copy = { id: "copy_test", files: [{ path: "kernel.py", source: "" }] };
    expect(() => editWorkingFile(copy, "missing.py", "text")).toThrow("does not exist");
    expect(() => editWorkingFile(copy, "kernel.py", "a".repeat(MAX_SOURCE_BYTES + 1))).toThrow("limit");
    expect(copy.files[0]?.source).toBe("");
  });
});
