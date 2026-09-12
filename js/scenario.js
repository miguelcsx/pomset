// The example scenario shown in the workbench: one source file and the
// evidence each mode produces for it. Evidence rows carry the source line they
// point at, which is what makes selecting a row highlight the code.

export const scenario = {
  path: "gateway/dispatch.py",
  entry: "tests/test_dispatch.py::test_cancel_propagates",
  language: "Python",
  source: [
    "async def dispatch(queue, sink):",
    "    pending = set()",
    "    while True:",
    "        item = await queue.get()",
    "        task = asyncio.create_task(handle(item, sink))",
    "        pending.add(task)",
    "        try:",
    "            await asyncio.wait_for(task, timeout=5)",
    "        except Exception:",
    "            # swallows CancelledError too",
    "            continue",
    "        finally:",
    "            pending.discard(task)",
  ],
};

// Keyed by mode so a lane shows evidence consistent with what it can produce.
export const evidenceByMode = {
  observe: {
    conclusion: "No se observaron fallos en estas ejecuciones.",
    detail: "1 ejecución · cobertura no medida",
    tone: "unknown",
    rows: [
      { seq: 1, actor: "task-0", op: "create_task", resource: "handle(item)", line: 5 },
      { seq: 2, actor: "task-0", op: "await", resource: "queue.get", line: 4 },
      { seq: 3, actor: "task-1", op: "wait_for", resource: "timeout=5", line: 8 },
      { seq: 4, actor: "task-1", op: "cancel", resource: "task-1", line: 8 },
      { seq: 5, actor: "task-1", op: "except", resource: "CancelledError", line: 9 },
      { seq: 6, actor: "task-1", op: "continue", resource: "loop", line: 11 },
    ],
  },
  explore: {
    conclusion: "Cancelación absorbida en 3 de 128 schedules.",
    detail: "128 schedules · semilla 41",
    tone: "violation",
    rows: [
      { seq: 1, actor: "sched", op: "seed", resource: "41", line: 1 },
      { seq: 2, actor: "task-1", op: "cancel", resource: "task-1", line: 8 },
      { seq: 3, actor: "task-1", op: "except", resource: "CancelledError", line: 9 },
      { seq: 4, actor: "task-1", op: "swallow", resource: "continue", line: 11 },
      { seq: 5, actor: "main", op: "await", resource: "nunca completa", line: 8 },
    ],
  },
  verify: {
    conclusion: "No concluyente: el modelo no cubre wait_for.",
    detail: "límite de presupuesto · modelo acotado",
    tone: "caution",
    rows: [
      { seq: 1, actor: "modelo", op: "supuesto", resource: "mundo cerrado", line: 1 },
      { seq: 2, actor: "modelo", op: "no soportado", resource: "asyncio.wait_for", line: 8 },
    ],
  },
};

// Operational states from section 16.2. "Terminado" says nothing about whether
// the program is correct; that verdict lives in the conclusion.
export const STAGES = ["en cola", "preparando", "construyendo", "ejecutando", "evidencia", "terminado"];
