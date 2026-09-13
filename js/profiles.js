// Single definition of the profile catalogue. In the API milestone this array
// is replaced by the catalogue endpoint and nothing that renders it changes.
//
// `support` and `availability` are deliberately separate axes: a profile can
// be validated and still have no free worker, which is a different situation
// from being unsupported.

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
    note: "Tareas, esperas y cancelaciones. Una espera larga es observación, no deadlock.",
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
    note: "Registra el estado efectivo del GIL: una extensión incompatible puede reactivarlo.",
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
    note: "El método de inicio se fija por perfil. spawn en Linux no prueba macOS.",
  },
  {
    id: "py313-asyncio-explore",
    language: "Python",
    version: "3.13",
    runtime: "asyncio",
    engine: "scheduler controlado de mundo cerrado",
    mode: "explore",
    support: "untested",
    availability: "queued",
    note: "Tiempo virtual sobre primitivas acotadas. uvloop necesita su propio perfil.",
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
    note: "Requiere tokio_unstable. La plataforma prepara el harness y muestra la diferencia.",
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
    note: "Scheduling controlado con replay. El resultado es del perfil Shuttle, no del nativo.",
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
    note: "Para componentes acotados. No modela la red ni las dependencias de un servidor.",
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
    note: "Detecta UB y carreras, e interpreta otros targets. El destino va declarado.",
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
    note: "Programas admitidos por su modelo LLVM. Aceptar IR no es entender cualquier runtime.",
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
    note: "Enumera las construcciones probadas. No cubre target offloading.",
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
    note: "Accesos conflictivos sin GPU en el servidor. El testigo no es ejecución física.",
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
    note: "Pendiente de admisión. El pool GPU sigue cerrado sin aislamiento equivalente.",
  },
];

export const languages = [...new Set(profiles.map((profile) => profile.language))].sort();

export const describe = (profile) =>
  `${profile.language} ${profile.version} · ${profile.runtime} · ${MODES[profile.mode]}`;
