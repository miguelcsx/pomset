// Entry point. Each initialiser is a no-op when its hook is absent from the
// page, so every page loads the same module and wires only what it contains.

import { initTheme } from "./theme.js";

initTheme();
