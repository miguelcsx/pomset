# Instrucciones para agentes

## Qué es esto

`pomset` es un workbench web de concurrencia multilenguaje. La especificación
técnica está en `docs/about.md` y es normativa: arquitectura, contratos,
aislamiento, presupuestos, catálogo y UI. No hay backend todavía.

Antes de proponer cualquier cosa, lee la sección que aplique. Si algo contradice
la spec, la spec gana o se abre un ADR; no se decide en el código.

## Ramas

| Rama | Contenido |
|---|---|
| `main` | Producto: documentos, licencia, utilidades. |
| `web/mock` | Mock navegable de la interfaz en HTML, CSS y JS sin frameworks. |

El mock no se mezcla con `main`. Es una maqueta para validar lenguaje visual y
estados de interacción, no el frontend definitivo (que será React + Monaco +
Dockview, ADR-006).

## Convenciones

- **Código en inglés**: nombres de archivo, identificadores, clases CSS, commits.
- **Textos visibles en español**. Los identificadores técnicos del dominio no se
  traducen: `runtime`, `Tokio`, `asyncio`, `deadlock`, `snapshot` (§22.3).
- Archivos de máximo 500 líneas, idealmente menos de 400. Una responsabilidad
  por archivo.
- Commits convencionales y firmados.

## Reglas que no se negocian

Vienen de los invariantes de producto (§23) y aplican también al mock:

- Ejecutar no es publicar. Terminar un trabajo no es demostrar corrección.
- «Sin fallos observados» nunca se presenta como prueba. El verde no significa
  seguro por sí solo.
- Una combinación incompatible se explica; nunca se sustituye en silencio por
  otra parecida.
- Un resultado pertenece al snapshot que se analizó, aunque la fuente cambie
  después.

## Antes de dar algo por terminado

Verifícalo en el navegador, no solo por lectura del código. Para el mock:
`python3 -m http.server` desde la raíz de la rama.
