"use client";

/**
 * The workbench is the whole product surface, and it is client-side: it renders
 * evidence a transport supplies and never analyses, measures or decides
 * eligibility. There is no route below it, because the working copy, the
 * scenario and the captured evidence are one stateful view.
 */

import { STATUS_ROLES } from "@pomset/ui";

import { Workbench } from "../src/features/Workbench";

export default function Page() {
  return <Workbench statusRoles={STATUS_ROLES} />;
}
