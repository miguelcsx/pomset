// Single definition of the profile catalogue (docs/about.md section 11.2).
// In the API milestone this array is replaced by the catalogue endpoint and
// nothing that renders it needs to change.
//
// `support` and `availability` are deliberately separate axes: a profile can
// be validated and still have no free worker, which is not the same as being
// unsupported (section 6.2).

export const MODES = {
  observe: "observar",
  explore: "explorar",
  verify: "verificar",
};

export const SUPPORT = {
  validated: { label: "validado", tone: "contract" },
  limited: { label: "validado con límites", tone: "caution" },
  untested: { label: "instalado, sin validar", tone: "unknown" },
};

export const AVAILABILITY = {
  immediate: { label: "ejecución inmediata", tone: "activity" },
  queued: { label: "en cola", tone: "caution" },
  none: { label: "sin worker libre", tone: "unknown" },
};

export const profiles = [
  {
    id: "py313-asyncio-observe",
    language: "Python",
    version: "3.13",
    runtime: "asyncio",
    engine: "VizTracer + introspección de asyncio",
    mode: "observe",
    support: "validated",
    availability: "immediate",
    note: "Tareas, esperas, cancelaciones y excepciones sin manejar. Una espera larga se reporta como observación, no como deadlock demostrado.",
  },
  {
    id: "py313-threading-observe",
    language: "Python",
    version: "3.13",
    runtime: "threading",
    engine: "instrumentación de primitivas",
    mode: "observe",
    support: "limited",
    availability: "immediate",
    note: "Registra el estado efectivo del GIL en cada ejecución: una extensión incompatible puede reactivarlo sin avisar.",
  },
  {
    id: "py313-multiprocessing-observe",
    language: "Python",
    version: "3.13",
    runtime: "multiprocessing",
    engine: "colector de árbol de procesos",
    mode: "observe",
    support: "limited",
    availability: "queued",
    note: "El método de inicio (spawn, fork, forkserver) se fija por perfil. Ejecutar spawn en Linux no prueba el comportamiento nativo de macOS.",
  },
  {
    id: "py313-asyncio-explore",
    language: "Python",
    version: "3.13",
    runtime: "asyncio",
    engine: "scheduler controlado de mundo cerrado",
    mode: "explore",
    support: "untested",
    availability: "none",
    note: "Tiempo virtual y entradas simuladas sobre un conjunto acotado de primitivas. Los event loops alternativos como uvloop necesitan su propio perfil.",
  },
  {
    id: "rust189-tokio-observe",
    language: "Rust",
    version: "1.89",
    runtime: "Tokio",
    engine: "console-subscriber",
    mode: "observe",
    support: "validated",
    availability: "immediate",
    note: "Requiere tokio_unstable y soporte de tracing; la plataforma prepara el harness y muestra la diferencia antes de ejecutar.",
  },
  {
    id: "rust189-shuttle-explore",
    language: "Rust",
    version: "1.89",
    runtime: "Tokio sustituido",
    engine: "Shuttle",
    mode: "explore",
    support: "validated",
    availability: "queued",
    note: "Scheduling controlado con reproducción de fallos. El resultado corresponde al perfil Shuttle, no a todas las ejecuciones del runtime nativo.",
  },
  {
    id: "rust189-loom-verify",
    language: "Rust",
    version: "1.89",
    runtime: "primitivas instrumentadas",
    engine: "Loom",
    mode: "verify",
    support: "limited",
    availability: "queued",
    note: "Para componentes acotados por el usuario. No se aplica a un servidor Tokio completo suponiendo que su red y dependencias quedan modeladas.",
  },
  {
    id: "rust189-miri-verify",
    language: "Rust",
    version: "1.89",
    runtime: "intérprete",
    engine: "Miri",
    mode: "verify",
    support: "validated",
    availability: "immediate",
    note: "Detecta cierto comportamiento indefinido y carreras, e interpreta targets distintos del host. Cada resultado declara que el destino fue interpretado.",
  },
  {
    id: "cpp20-genmc-verify",
    language: "C++",
    version: "20",
    runtime: "pthreads",
    engine: "GenMC",
    mode: "verify",
    support: "limited",
    availability: "queued",
    note: "Opera sobre programas admitidos por su modelo a nivel LLVM. Aceptar LLVM IR no implica comprender cualquier runtime bajado a LLVM.",
  },
  {
    id: "openmp5-archer-observe",
    language: "C/C++",
    version: "OpenMP 5.2",
    runtime: "libomp",
    engine: "Archer + ThreadSanitizer",
    mode: "observe",
    support: "limited",
    availability: "immediate",
    note: "El perfil enumera las construcciones probadas. La instrumentación del host no cubre target offloading.",
  },
  {
    id: "cuda126-faial-verify",
    language: "CUDA",
    version: "12.6",
    runtime: "modelo de kernel",
    engine: "Faial",
    mode: "verify",
    support: "validated",
    availability: "immediate",
    note: "Análisis estático de accesos conflictivos, útil sin GPU en el servidor. El testigo estático no equivale a una ejecución física.",
  },
  {
    id: "cuda126-native-observe",
    language: "CUDA",
    version: "12.6",
    runtime: "hardware NVIDIA",
    engine: "instrumentación en dispositivo",
    mode: "observe",
    support: "untested",
    availability: "none",
    note: "Pendiente de admisión técnica y contractual. El pool GPU permanece cerrado hasta disponer de controles de aislamiento equivalentes.",
  },
];

export const languages = [...new Set(profiles.map((profile) => profile.language))].sort();

export const describe = (profile) =>
  `${profile.language} ${profile.version} · ${profile.runtime} · ${MODES[profile.mode]}`;
