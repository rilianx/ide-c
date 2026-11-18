# IDE C · Estructuras de Datos

Un IDE en el navegador para hacer los labs del curso: archivos `.h`/`.c`, un asistente para armar el código eligiendo piezas y tests con salida esperada vs. obtenida. No necesita servidor: el código C se compila y ejecuta dentro del navegador con [xcc-wasm](https://www.npmjs.com/package/@basthon/xcc-wasm) (el compilador [xcc](https://github.com/tyfkda/xcc) compilado a WebAssembly).

## Cómo funciona un ejercicio

- La app trae la **implementación completa** de la estructura, oculta (`oculto/list_ref.c`).
- El estudiante escribe **una función a la vez** en `list.c`. Cada función que define reemplaza a la del curso; las que no escribió usan la referencia. Así cada función se prueba por separado.
- Los **tests usan solo la interfaz** (`list.h`): cada test es un trozo de C que llama a la interfaz e imprime algo, y se compara su salida con la esperada.
- **▶ Probar actual** compila `list.c` + la referencia y corre los tests de la función elegida; **▶▶ Probar todas**, los de todas las funciones que el estudiante ya escribió.
- **Asistente de comandos** (bajo el editor, como en Puntero C): se elige la función que se implementa y se arman líneas eligiendo piezas: declarar variables, reservar memoria (`malloc`, `createNode`), asignar campos, `if`/`else`/`while`, `return`. Las piezas son las variables y campos que existen en ese punto y del tipo que corresponde (`list->head`, `nuevo->next`…). También se puede escribir con el teclado.
- Las columnas cambian de ancho arrastrando los divisores (doble clic: ocultar/mostrar).

Errores que la app explica: no compila (con enlace a la línea), desreferencia de `NULL`, índice fuera de un arreglo, división por cero, recursión infinita y ciclos infinitos (se detienen a los 4 s).

## Estructura

```
index.html
css/ide.css
js/main.js         interfaz: ejercicio, pasos y tests
js/asistente.js    comandos para armar líneas (plantillas con huecos y piezas según el tipo)
js/divisores.js    columnas de ancho ajustable
js/editor.js       editor con pestañas de archivo (CodeMirror 5)
js/proyecto.js     lógica pura: funciones y variables del archivo, armar el programa, comparar salidas
js/tests.js        correr los tests y mostrar esperado vs. obtenido
js/runner.js       habla con el worker y lo reinicia si algo se cuelga
js/worker.js       compila y ejecuta con xcc-wasm (en un Web Worker)
js/ejercicios.js   carga los ejercicios y guarda lo del estudiante (localStorage)
ejercicios/        un directorio por lab
vendor/            xcc-wasm y CodeMirror (MIT), copiados para no depender de un CDN
herramientas/      validar un ejercicio con gcc
```

Son módulos ES nativos, sin paso de compilación: la carpeta se publica tal cual.

## Agregar un lab

1. Crear `ejercicios/<id>/` con:
   - los archivos visibles (por ejemplo `list.h` con la interfaz y los structs, y `list.c` casi vacío);
   - `oculto/<ref>.c`: la implementación completa, con cada función de la interfaz entre `#ifndef ALUMNO_<funcion>` … `#endif`;
   - `oculto/ayudas.c` (opcional): funciones para los tests, que usan solo la interfaz;
   - `ejercicio.json`: archivos (cuáles se pueden editar), funciones de la interfaz, `estructuras` (los campos de cada struct y su tipo, para las piezas del asistente), `constructores` (como `createNode`) y pasos. Cada paso tiene su enunciado, la plantilla de cada función y sus tests (`nombre`, `codigo`, `esperado`). Opcional: `migrar`, pares [antes, después] que se reemplazan en lo que el estudiante tiene guardado (por ejemplo, si cambia el nombre de un .h).
2. Agregarlo a `ejercicios/index.json`.
3. Validarlo con gcc: `node herramientas/probar-nativo.mjs ejercicios/<id>` (con la referencia deben pasar todos). Con un archivo de estudiante como segundo argumento se puede ver qué tests fallan.

## Publicar

Con GitHub Pages (Settings → Pages → la rama y la carpeta de la app). Hace falta un servidor: abriendo `index.html` directo desde el disco (`file://`) el navegador no deja cargar los ejercicios ni el compilador. Para probar en local: `python3 -m http.server` en esta carpeta y abrir http://localhost:8000.

Antes de cada commit que se publica, conviene correr `node herramientas/version.mjs`: pone un número de versión en las URLs de los JS y el CSS para que el navegador no mezcle archivos nuevos con otros viejos guardados en caché.

## Visualización

La pestaña **Visualización** corre un test con el `list.c` del estudiante y dibuja la memoria (estática, sin animación) después de cada línea del test: la `List` con `head`, `tail` y `current`, y cada nodo como `[prev | dato | next]` con flechas. Las líneas que no cambian la memoria se juntan con el dibujo anterior. Los punteros basura se marcan con `?`. Se dibuja sola al abrir la pestaña o elegir otro test (si cambió el código).

Si la función del test ya la escribió el estudiante, cada línea del test que la llama tiene «🔍 Ver dentro de tu …»: la memoria después de cada línea de su función, con sus variables `Node *` (`nuevo`, `aux`…) como etiquetas amarillas, separadas por llamada. Un nodo que aún no está en la lista pero ya apunta a uno de ella se dibuja a su lado con borde punteado. Tocar `list.c:N` lleva a esa línea del código. Para esto, `instrumentarFuncion` agrega volcados en la misma línea (no cambia los números de línea); si alguna línea no se puede instrumentar y no compila, se muestra solo el test.

Cómo funciona: `js/proyecto.js` (`instrumentar`) agrega `__volcar(línea, L);` después de cada instrucción del test; `oculto/vis.c` imprime una línea `@@VIS` con la lista en JSON (revisa cada puntero antes de seguirlo); `js/visual.js` la dibuja en SVG. En `ejercicio.json`, la clave `visual` indica el archivo del volcado, la variable y su tipo.

## Pendiente

- Visualización: elegir qué variables dibujar, otras estructuras (pilas, colas, árboles) y marcar nodos liberados.
- Labs 1, 3, 4 y 5.
