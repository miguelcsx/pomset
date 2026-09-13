# pomset — mock de interfaz

Maqueta navegable de la interfaz de **pomset**, un workbench web donde ejecutas,
observas y verificas programas concurrentes sin instalar nada. Hecha en HTML, CSS
y JavaScript puro, sin frameworks.

**Sitio:** https://pomset.vercel.app
**Producto y especificación:** rama [`main`](https://github.com/miguelcsx/pomset/tree/main)

## De qué va

La especificación completa de pomset son mil líneas: arquitectura, aislamiento,
presupuestos, catálogo de motores. Esta rama toma solo la capa visible y la
vuelve navegable, para decidir el lenguaje visual y los estados de interacción
antes de escribir el producto de verdad.

El problema que resuelve pomset es concreto. Hoy verificar concurrencia obliga a
instalar un toolchain distinto por lenguaje —VizTracer para asyncio, Shuttle
para Tokio, Faial para CUDA— y cada uno reporta a su manera. pomset los pone
detrás del mismo sistema de proyectos, escenarios y evidencia.

![Workbench en escritorio](docs/screenshots/workbench.png)

### Las tres pantallas

- **Inicio** — los tres modos (observar, explorar, verificar), ejemplos y el
  formulario de importación.
- **Workbench** — fuente, carriles de análisis y evidencia. Es el core.
- **Catálogo** — los perfiles disponibles, filtrables.

### Lo que muestra el workbench

Abre directamente sobre la comparación que justifica el producto: el mismo
archivo, analizado con dos perfiles, con dos respuestas distintas.

El perfil de observación dice *«No se observaron fallos en estas ejecuciones»*
con su cobertura al lado. El de exploración, sobre el mismo código, encuentra
*«Cancelación absorbida en 3 de 128 schedules»*. Al hacer clic en un evento de
la evidencia, la línea correspondiente se marca en la fuente.

Esa distinción es deliberada y viene de la especificación: ausencia de fallos
observados no es prueba de corrección, y la interfaz no puede presentarlas
igual. Por eso el verde nunca aparece solo para decir «seguro».

## Decisiones técnicas

### Dónde usé Flexbox y dónde Grid

Grid donde hay una cuadrícula real y bidimensional. El workbench es lo más
claro: tres zonas más un panel inferior que cruza el ancho completo, declarado
con `grid-template-areas` en `css/workbench.css`. Cambiar el layout en cada
breakpoint es reescribir el mapa de áreas, sin tocar el orden del HTML. El
catálogo también es Grid, con `repeat(auto-fill, minmax(300px, 1fr))`, que
reacomoda las columnas según el ancho sin media queries.

Flexbox donde hay una fila de cosas que negocian espacio entre ellas: la barra
de cada panel (título a un lado, controles al otro con `margin-left: auto`), el
header, la barra de estado, el encabezado de cada carril. En todos esos casos no
hay cuadrícula, hay una línea.

### Qué hace el JavaScript

Cuatro módulos, cada uno con una responsabilidad.

`js/profiles.js` es la única definición del catálogo. Cuando exista la API
—Entrega 2— ese arreglo se reemplaza por la respuesta del servidor y nada de lo
que dibuja cambia.

`js/catalog.js` filtra y dibuja. La función de filtrado es pura: recibe la lista
y los criterios, devuelve otra lista, no toca el DOM. Se puede leer sin pensar
en HTML.

`js/import-form.js` valida. Las reglas son datos, no condicionales: cada campo
tiene una lista de comprobaciones y el mensaje que aparece cuando falla. Agregar
un campo es agregar una entrada al objeto `rules`.

`js/workbench.js` maneja los carriles. Todo el estado vive en un objeto, unas
funciones puras construyen el HTML a partir de él, y un único `render()` lo
escribe. Los manejadores solo cambian el estado y vuelven a llamar a `render()`.

### Cómo funciona la validación

El formulario lleva `novalidate`: la burbuja nativa del navegador no sirve aquí
porque el mensaje debe quedar junto al campo. Cada campo tiene primero un
`required` y después comprobaciones de formato, y esas de formato ignoran el
campo vacío para que no aparezcan dos errores por lo mismo.

Al enviar, se recogen los valores, se validan, se pintan todos los errores de
una vez y el foco salta al primer campo que falló. Mientras escribes, el error
de ese campo se borra. `aria-invalid` acompaña cada estado, así que un lector de
pantalla recibe lo mismo que se ve.

### Por qué el mock vive en una rama aparte

`main` es el repositorio del producto: especificación, licencia, instrucciones.
El frontend real será React con Monaco y Dockview, ya decidido en un ADR. Este
mock es plano y desechable por diseño, así que mezclarlo con `main` ensuciaría
el repositorio con archivos que van a morir. Vive en `web/mock`, y Vercel
publica esa rama.

Una consecuencia: el header se repite en los tres HTML. Sin build no hay
includes, y la alternativa —inyectarlo con JavaScript— rompería la estructura
semántica que el navegador necesita desde el primer render. Doce líneas
repetidas salen más baratas que eso.

### Uso de IA

La dirección fue mía: el dominio, la especificación de la que sale todo el
contenido y las decisiones de producto. La IA escribió código bajo esa
dirección, y rechacé varias versiones antes de llegar a esta.

Tres rechazos concretos. El selector de perfiles ofrecía Rust y CUDA sobre un
archivo Python, lo cual no tiene sentido y además contradice la especificación,
que prohíbe exactamente ese tipo de sustitución silenciosa. La primera versión
del workbench abría vacía, mostrando dropdowns y barras de progreso: maquinaria,
no producto; ahora abre sobre la comparación. Y el texto sobraba por todos lados
—párrafos explicando lo que la propia interfaz ya decía—, así que lo recorté y
cambié etiquetas por iconos donde el icono bastaba.

### Lo más difícil

Mantener el estado de los carriles coherente en JavaScript plano. Hay cuatro
cosas que cambian a la vez y dependen entre sí: qué carriles existen, en qué
etapa va cada uno, cuál está activo y qué fila de evidencia está seleccionada.
Mi primer intento actualizaba el DOM por partes —cambiar la etiqueta de la
etapa aquí, la clase del carril allá— y se desincronizaba en cuanto dos cosas
pasaban juntas, por ejemplo cancelar un carril mientras otro terminaba.

Lo resolví al revés: un solo objeto de estado y un único `render()` que redibuja
todo desde él. Es menos eficiente, y con listas grandes no serviría, pero con
cuatro carriles no se nota y elimina toda una clase de errores. El costo fue que
los manejadores de eventos morían en cada redibujado, así que pasé a delegación:
un listener por panel que mira qué elemento recibió el clic.

## Accesibilidad

Criterio WCAG 2.2 AA. Navegación completa por teclado, incluidas las filas de
evidencia, que responden a Enter y espacio. Foco visible de 2px que no depende
del color de diagnóstico. Landmarks y jerarquía de encabezados correctos en las
tres páginas. Las transiciones respetan `prefers-reduced-motion`.

## Responsive

![Workbench en móvil](docs/screenshots/workbench-mobile.png)

Los cortes vienen de la especificación. Por encima de 1280px se ven los tres
paneles; entre 900 y 1280 el árbol de archivos se colapsa porque es lo primero
prescindible; por debajo de 900 los paneles se apilan. A 320px nada se desborda:
lo que no cabe —la tabla de evidencia, el código— desplaza dentro de su propio
panel, no arrastra la página.

## Correr el proyecto

```bash
git clone -b web/mock https://github.com/miguelcsx/pomset.git
cd pomset
python3 -m http.server 4174
```

No hay build ni dependencias.

## Licencia

Apache-2.0.
