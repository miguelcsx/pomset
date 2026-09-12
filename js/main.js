// Entry point. Each initialiser is a no-op when its hook is absent from the
// page, so every page loads the same module and wires only what it contains.

import { initTheme } from "./theme.js";
import { initCatalog } from "./catalog.js";
import { initImportForm } from "./import-form.js";
import { initWorkbench } from "./workbench.js";

initTheme();
initCatalog();
initImportForm();
initWorkbench();
