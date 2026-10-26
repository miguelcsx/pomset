import { STATUS_ROLES } from "@pomset/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Workbench } from "./app/Workbench.js";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root element");

createRoot(root).render(
  <StrictMode>
    <Workbench statusRoles={STATUS_ROLES} />
  </StrictMode>,
);
