# pomset

Ejecuta, observa y verifica programas concurrentes en runtimes reales, desde el navegador y sin instalar nada.

La unidad de trabajo no es un snippet pegado en un editor: es un **proyecto versionado, un escenario de prueba y un conjunto de perfiles**. Un programa Python con asyncio, un workspace Rust con Tokio y un proyecto CMake con OpenMP usan el mismo sistema de proyectos, trabajos, resultados y publicación, aunque sus motores y garantías sean distintos.

## Los tres modos

| Modo | Qué hace | Qué puede ofrecer |
|---|---|---|
| Observar | Ejecuta un escenario instrumentado en un runtime real. | Traza, diagnósticos dinámicos, recursos y comportamiento observado. |
| Explorar | Ejecuta bajo scheduling o entorno controlado. | Ejecuciones alternativas, fallos reproducibles y cobertura del dominio explorado. |
| Verificar | Consulta un motor formal o estático sobre una propiedad. | Propiedad establecida bajo contrato, contraejemplo, alerta o resultado no concluyente. |

Ningún modo sustituye a los otros. Una prueba formal sobre un modelo restringido no cubre todas las extensiones nativas de un programa, y una ejecución sin errores no demuestra corrección.

## Estado

Pre-implementación. La especificación técnica vive en `docs/` y define arquitectura, contratos, aislamiento, presupuestos, catálogo y UI. No hay backend todavía.

La rama `web/mock` contiene un mock navegable de la interfaz en HTML, CSS y JavaScript sin frameworks: catálogo de perfiles, workbench con carriles y panel de evidencia. Sirve para validar el lenguaje visual y los estados de interacción antes de escribir el producto.

## Invariantes

Ejecutar no significa publicar. Compilar para un target no significa ejecutarlo físicamente. Terminar un trabajo no significa demostrar corrección. Reabrir evidencia no significa obtener una muestra nueva. Editar fuente no cambia resultados históricos.

## Licencia

Apache-2.0. La reutilización selectiva de Compiler Explorer conserva sus avisos BSD-2-Clause.
