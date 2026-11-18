# IDE C · Estructuras de Datos

Un IDE en el navegador para hacer los labs del curso: archivos `.h`/`.c`, un asistente para armar el código eligiendo piezas y tests con salida esperada vs. obtenida. No necesita servidor: el código C se compila y ejecuta dentro del navegador con [xcc-wasm](https://www.npmjs.com/package/@basthon/xcc-wasm) (el compilador [xcc](https://github.com/tyfkda/xcc) compilado a WebAssembly).

## Cómo funciona un ejercicio

- La app trae la **implementación completa** de la estructura, oculta (`oculto/list_ref.c.enc`, cifrada).
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

En el panel de Tests, cada test tiene **👁 Ver**: corre ese test con el `list.c` del estudiante y dibuja la memoria (estática, sin animación) después de cada línea del test: la `List` con `head`, `tail` y `current`, y cada nodo como `[prev | dato | next]` con flechas. Las líneas que no cambian la memoria se juntan con el dibujo anterior. Los punteros basura se marcan con `?`. La visualización aparece en el mismo panel (← Tests vuelve a la lista) y se vuelve a dibujar sola al editar el código, manteniendo el paso.

Se recorre **paso a paso**, como un depurador: **Siguiente ▶** ejecuta una línea del test (o de la función, si se está adentro), **◀ Atrás** retrocede, **⤵ Entrar** muestra por dentro la función del estudiante que llama esa línea (línea a línea en su `list.c`, con sus variables `Node *` como etiquetas amarillas) y **⤴ Terminar la llamada / Volver al test** sale. También con las flechas del teclado. A la izquierda se ve el código con la línea recién ejecutada; a la derecha, la memoria y lo impreso hasta ahí. Cada nodo queda en un lugar fijo durante toda la ejecución (no se mueve al cambiar los enlaces, solo cambian las flechas). Los lugares siguen el orden de la lista al final del test; uno eliminado queda donde estaba entre sus vecinos y uno que nunca se enlazó va al final. Un nodo se identifica por su dirección: si otro ocupa después esa memoria, ocupa también su lugar; los que no se alcanzan desde head siguiendo next van con borde punteado, y los liberados con `free` quedan semitransparentes en rojo, con el contenido que tenían al liberarse, hasta que otro nodo ocupe esa memoria (la app redefine `malloc`/`calloc`/`free` para saber qué direcciones se liberaron). Para entrar, `instrumentarFuncion` agrega volcados en la misma línea (no cambia los números de línea); si alguna línea no se puede instrumentar y no compila, se recorre solo el test.

Cómo funciona: `js/proyecto.js` (`instrumentar`) agrega `__volcar(línea, L);` después de cada instrucción del test; `oculto/vis.c` imprime una línea `@@VIS` con la lista en JSON (revisa cada puntero antes de seguirlo); `js/visual.js` la dibuja en SVG. En `ejercicio.json`, la clave `visual` indica el archivo del volcado, la variable y su tipo.

El asistente sugiere nombres de variables sacados del código base (los `.h` y el código del curso: `nuevo`, `aux`, `siguiente`…), y después algunos genéricos.

## Modo profesor

Con `?profesor` en la URL (https://rilianx.github.io/ide-c/?profesor), `list.c` parte con todas las funciones de los pasos ya hechas (las de la referencia) y aparece la marca **Profesor** arriba. Sirve para mostrar en clase los tests y la visualización paso a paso con las funciones completas. Lo que se cambie en este modo se guarda aparte: no toca lo del modo normal. «⟲ Restaurar archivos» vuelve a las funciones del curso.

Pide una **contraseña**: la solución legible está en `oculto/solucion.enc`, cifrada con AES-GCM (clave derivada de la contraseña con PBKDF2) y sin la contraseña no se puede leer. La contraseña se recuerda mientras la pestaña esté abierta.

## Archivos cifrados

- `oculto/solucion.enc`: la solución completa, con comentarios (modo profesor; con la contraseña).
- `oculto/list_ref.c.enc`: la misma solución compactada (sin comentarios), cifrada con una clave que va en la página (`js/cifrado.js`). La usa el modo estudiante para las funciones que aún no escribe: como el navegador tiene que compilarla, esto solo evita que se lea abriendo el archivo; quien sepa usar las herramientas del navegador la puede sacar.
- Los fuentes en claro van en `ejercicios/<ej>/fuente/`, que **no se sube a git**. Para editar la solución:

```
node herramientas/cifrar.mjs descifrar ejercicios/lab2-lista CONTRASEÑA   # crea fuente/list_ref.c
# editar fuente/list_ref.c
node herramientas/cifrar.mjs cifrar ejercicios/lab2-lista CONTRASEÑA      # vuelve a crear los .enc
node herramientas/probar-nativo.mjs ejercicios/lab2-lista                 # comprobar: deben pasar todos
```

Para cambiar la contraseña: descifrar con la antigua y cifrar con la nueva.

## Pendiente

- Visualización: elegir qué variables dibujar, otras estructuras (pilas, colas, árboles) y marcar nodos liberados.
- Labs 1, 3, 4 y 5.
