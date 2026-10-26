import { useEffect, useRef, useState } from "react";
import { schemaSet } from "@pomset/contracts/browser";
export function RenameFile({ path, paths, onRename, onClose }: { path: string; paths: readonly string[]; onRename: (path: string) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(path);
  const [error, setError] = useState<string>();
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog className="disclosure-dialog" ref={dialog} onCancel={onClose} onClose={onClose}><form onSubmit={(event) => { event.preventDefault();
    if (!schemaSet().validatorFor("domain.schema.yaml#/$defs/path")(value) || value.split("/").includes(".")) { setError("Use a relative file path without traversal."); return; }
    if (value !== path && paths.includes(value)) { setError("A file already has that path."); return; }
    onRename(value); onClose();
  }}><h2>Rename file</h2><label>Workspace path<input autoFocus aria-label="File path" value={value} onChange={(event) => setValue(event.target.value)} /></label>{error && <p role="alert">{error}</p>}<div className="dialog-actions"><button type="button" onClick={onClose}>Cancel</button><button type="submit">Rename</button></div></form></dialog>;
}
