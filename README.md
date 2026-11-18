# IDE C · Estructuras de Datos

Un IDE en el navegador para hacer los labs del curso: archivos `.h`/`.c`, ▶ Play y tests con salida esperada vs. obtenida. No necesita servidor: el código C se compila y ejecuta dentro del navegador con [xcc-wasm](https://www.npmjs.com/package/@basthon/xcc-wasm) (el compilador [xcc](https://github.com/tyfkda/xcc) compilado a WebAssembly).

## Cómo funciona un ejercicio

- La app trae la **implementación completa** de la estructura, oculta (`oculto/list_ref.c`).
- El estudiante escribe **una función a la vez** en `list.c`. Cada función que define reemplaza a la del curso; las que no escribió usan la referencia. Así cada función se prueba por separado.
- Los **tests usan solo la interfaz** (`list.h`): cada test es un trozo de C que llama a la interfaz e imprime algo, y se compara su salida con la esperada.
- **▶ Play** compila y ejecuta `main.c` sobre `list.c` + la referencia, con la entrada (stdin) que se escriba en la consola.

Errores que la app explica: no compila (con enlace a la línea), desreferencia de `NULL`, índice fuera de un arreglo, división por cero, recursión infinita y ciclos infinitos (se detienen a los 4 s).

## Estructura

```
index.html
css/ide.css
js/main.js         interfaz: ejercicio, pasos, ▶ Play, tests
js/editor.js       editor con pestañas de archivo (CodeMirror 5)
js/proyecto.js     lógica pura: funciones del estudiante, armar el programa, comparar salidas
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
   - los archivos visibles (por ejemplo `list.h`, `list_interno.h` con los structs, `list.c` casi vacío y `main.c`);
   - `oculto/<ref>.c`: la implementación completa, con cada función de la interfaz entre `#ifndef ALUMNO_<funcion>` … `#endif`;
   - `oculto/ayudas.c` (opcional): funciones para los tests, que usan solo la interfaz;
   - `ejercicio.json`: archivos (cuáles se pueden editar), funciones de la interfaz y pasos. Cada paso tiene su enunciado, su plantilla y sus tests (`nombre`, `codigo`, `esperado`).
2. Agregarlo a `ejercicios/index.json`.
3. Validarlo con gcc: `node herramientas/probar-nativo.mjs ejercicios/<id>` (con la referencia deben pasar todos). Con un archivo de estudiante como segundo argumento se puede ver qué tests fallan.

## Publicar

Con GitHub Pages (Settings → Pages → la rama y la carpeta de la app). Hace falta un servidor: abriendo `index.html` directo desde el disco (`file://`) el navegador no deja cargar los ejercicios ni el compilador. Para probar en local: `python3 -m http.server` en esta carpeta y abrir http://localhost:8000.

## Pendiente

- La pestaña **Visualización** (memoria, como en Puntero C).
- Labs 1, 3, 4 y 5.
