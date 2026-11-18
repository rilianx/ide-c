// Lógica pura del proyecto (sin DOM): qué funciones escribió el estudiante,
// cómo se arma el programa que se compila y cómo se comparan las salidas.
// Se puede importar desde node para probarla.

// Quita comentarios y literales de texto, para no confundir código comentado con código real.
export function sinComentarios(texto) {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, '')
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''");
}

// Funciones de la lista `nombres` que están definidas (con cuerpo) en el texto.
export function funcionesDefinidas(texto, nombres) {
  const limpio = sinComentarios(texto);
  return nombres.filter(n => new RegExp(`\\b${n}\\s*\\([^;{}()]*\\)\\s*\\{`).test(limpio));
}

// Agrega al archivo del estudiante la plantilla de un paso, si sus funciones aún no están.
export function agregarPlantilla(texto, paso) {
  const faltan = paso.funciones.filter(f => !funcionesDefinidas(texto, [f]).length);
  if (!faltan.length) return texto;
  const sep = texto.endsWith('\n\n') ? '' : texto.endsWith('\n') ? '\n' : '\n\n';
  return `${texto}${sep}// ${paso.titulo}\n${paso.plantilla}`;
}

const REF = '__ref.c', AYUDAS = '__ayudas.c', TESTS = '__tests.c', PROGRAMA = '__programa.c';

// Los #define que sacan de la referencia las funciones que el estudiante escribió.
function defines(ej, archivos) {
  const propias = funcionesDefinidas(archivos[ej.alumno] ?? '', ej.funciones);
  return { propias, texto: propias.map(f => `#define ALUMNO_${f} 1\n`).join('') };
}

// Archivos que ve el compilador: los del proyecto, la referencia y las ayudas (ocultos).
function base(ej, archivos, ocultos) {
  const files = { ...archivos };
  files[REF] = ocultos[ej.referencia];
  if (ej.ayudas) files[AYUDAS] = ocultos[ej.ayudas];
  return files;
}

// Programa para ▶ Play: el main del estudiante sobre su list.c + la referencia.
export function armarPlay(ej, archivos, ocultos) {
  const files = base(ej, archivos, ocultos);
  const d = defines(ej, archivos);
  files[PROGRAMA] = `${d.texto}#include "${ej.alumno}"\n#include "${REF}"\n#include "${ej.programa}"\n` +
    `char *__argv[] = {"programa", 0};\n`;
  return { files, propias: d.propias, prelude: `#include "${PROGRAMA}"`,
    calls: [{ id: 'main', code: 'main(1, __argv);' }] };
}

// Programa para los tests: cada test es una función __test_N; se llaman una por una.
export function armarTests(ej, archivos, ocultos, tests) {
  const files = base(ej, archivos, ocultos);
  const d = defines(ej, archivos);
  files[TESTS] = tests.map((t, i) => `void __test_${i}(void) {\n${t.codigo}\n}\n`).join('\n');
  files[PROGRAMA] = `${d.texto}#include "${ej.alumno}"\n#include "${REF}"\n` +
    (ej.ayudas ? `#include "${AYUDAS}"\n` : '') + `#include "${TESTS}"\n`;
  return { files, propias: d.propias, prelude: `#include "${PROGRAMA}"`,
    calls: tests.map((t, i) => ({ id: i, code: `__test_${i}();` })) };
}

// Salidas iguales salvo espacios al final de cada línea y líneas vacías al final.
export function normalizar(s) {
  return (s ?? '').replace(/\r/g, '').split('\n').map(l => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '');
}
export const mismaSalida = (esperado, obtenido) => normalizar(esperado) === normalizar(obtenido);

// Mensajes del compilador: «/list.c:12:5: error: ...» → {archivo, linea, texto}. Los archivos internos se ocultan.
export function mensajes(texto) {
  const out = [];
  for (const linea of (texto ?? '').split('\n')) {
    if (!linea.trim()) continue;
    const m = /^\/?([\w.\-\/]+?)(?::|\()(\d+)(?::\d+)?\)?:?\s*(.*)$/.exec(linea);
    if (m) out.push({ archivo: m[1], linea: +m[2], texto: m[3] });
    else out.push({ archivo: null, linea: null, texto: linea });
  }
  return out;
}
