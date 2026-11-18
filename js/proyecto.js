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

// Como sinComentarios, pero sin cambiar el largo (las posiciones siguen valiendo).
export function enmascarar(texto) {
  const blanco = m => m.replace(/[^\n]/g, ' ');
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, blanco)
    .replace(/\/\/[^\n]*/g, blanco)
    .replace(/"(?:\\.|[^"\\\n])*"/g, m => '"' + ' '.repeat(m.length - 2) + '"')
    .replace(/'(?:\\.|[^'\\\n])*'/g, m => "'" + ' '.repeat(m.length - 2) + "'");
}

// Tipo C → {base, ptr}: «void *» → {base:'void', ptr:1}; «List*» → {base:'List', ptr:1}.
function tipo(t) {
  const s = t.replace(/\b(const|struct|static|unsigned|signed)\b/g, ' ').trim();
  return { base: s.replace(/\*/g, '').trim(), ptr: (s.match(/\*/g) || []).length };
}

// Funciones definidas en el archivo (nivel superior): nombre, tipo de retorno, parámetros y posiciones.
export function funcionesDelArchivo(texto) {
  const m = enmascarar(texto), out = [];
  let prof = 0;
  for (let i = 0; i < m.length; i++) {
    if (m[i] === '{') {
      if (prof === 0) {
        const antes = m.slice(0, i);
        const f = /([A-Za-z_][\w \t\*]*?[\s\*])([A-Za-z_]\w*)\s*\(([^()]*)\)\s*$/.exec(antes);
        if (f) {
          let j = i + 1, p = 1;
          while (j < m.length && p) { if (m[j] === '{') p++; else if (m[j] === '}') p--; j++; }
          const params = !f[3].trim() || f[3].trim() === 'void' ? [] : f[3].split(',').map(s => {
            const q = /^(.*?)([A-Za-z_]\w*)\s*$/.exec(s.trim());
            return q ? { nombre: q[2], ...tipo(q[1]) } : null;
          }).filter(Boolean);
          out.push({ nombre: f[2], retorno: tipo(f[1]), params, cuerpo: i + 1, fin: p ? m.length : j - 1 });
        }
      }
      prof++;
    } else if (m[i] === '}') prof = Math.max(0, prof - 1);
  }
  return out;
}

// La función donde está la posición (o null).
export function funcionEn(texto, pos) {
  return funcionesDelArchivo(texto).find(f => pos >= f.cuerpo && pos <= f.fin) ?? null;
}

// Variables visibles en `pos` dentro de la función: parámetros + declaraciones anteriores.
export function variablesEn(texto, fn, pos) {
  const vars = fn.params.map(p => ({ ...p }));
  const cuerpo = enmascarar(texto).slice(fn.cuerpo, pos);
  const re = /(?:^|[;{}\s(])((?:const\s+|struct\s+)*[A-Za-z_]\w*)\s*(\*+)?\s*([A-Za-z_]\w*)\s*(?==[^=]|;|,|\[)/g;
  const noTipos = new Set(['return', 'if', 'while', 'for', 'else', 'do', 'switch', 'case', 'sizeof', 'free', 'goto']);
  let r;
  while ((r = re.exec(cuerpo))) {
    const base = r[1].replace(/\b(const|struct)\b/g, '').trim();
    if (noTipos.has(base) || noTipos.has(r[3])) continue;
    if (!/^(int|char|float|double|long|short|void|[A-Z]\w*)$/.test(base)) continue;   // tipos básicos o con mayúscula (List, Node…)
    vars.push({ nombre: r[3], base, ptr: (r[2] || '').length });
  }
  const vistos = new Map();
  for (const v of vars) vistos.set(v.nombre, v);   // la última declaración gana
  return [...vistos.values()];
}

// Funciones de la lista `nombres` que están definidas (con cuerpo) en el texto.
export function funcionesDefinidas(texto, nombres) {
  const limpio = sinComentarios(texto);
  return nombres.filter(n => new RegExp(`\\b${n}\\s*\\([^;{}()]*\\)\\s*\\{`).test(limpio));
}

// Funciones que el estudiante realmente escribió: definidas y con un cuerpo distinto
// al de la plantilla (una plantilla sin tocar sigue usando la versión del curso).
export function funcionesPropias(ej, texto) {
  const plantillas = Object.assign({}, ...ej.pasos.map(p => p.plantillas ?? {}));
  const compacto = s => sinComentarios(s).replace(/\s+/g, '');
  const cuerpos = new Map(funcionesDelArchivo(texto).map(f => [f.nombre, texto.slice(f.cuerpo, f.fin)]));
  return funcionesDefinidas(texto, ej.funciones).filter(f => {
    const pl = plantillas[f], cu = cuerpos.get(f);
    if (!pl || cu == null) return true;
    const i = pl.indexOf('{'), j = pl.lastIndexOf('}');
    return compacto(cu) !== compacto(pl.slice(i + 1, j));
  });
}

// El archivo del estudiante tal como se compila: las plantillas sin tocar se dejan en blanco
// para que no choquen con la versión del curso. Las líneas no cambian.
function sinPlantillas(ej, texto) {
  const propias = new Set(funcionesPropias(ej, texto));
  const sobran = funcionesDelArchivo(texto).filter(f => ej.funciones.includes(f.nombre) && !propias.has(f.nombre));
  for (const f of sobran.reverse()) {
    const antes = texto.slice(0, f.cuerpo);
    const k = antes.lastIndexOf(f.nombre, antes.lastIndexOf('('));
    const ini = texto.lastIndexOf('\n', k) + 1, fin = f.fin + 1;
    texto = texto.slice(0, ini) + texto.slice(ini, fin).replace(/[^\n]/g, ' ') + texto.slice(fin);
  }
  return texto;
}

// Agrega al archivo del estudiante las plantillas de las funciones que aún no están
// (todas las del paso, o solo `cuales`).
export function agregarPlantilla(texto, paso, cuales = paso.funciones) {
  const faltan = cuales.filter(f => !funcionesDefinidas(texto, [f]).length);
  if (!faltan.length) return texto;
  const sep = texto.endsWith('\n\n') ? '' : texto.endsWith('\n') ? '\n' : '\n\n';
  return `${texto}${sep}// ${paso.titulo}\n${faltan.map(f => paso.plantillas[f]).join('\n')}`;
}

const REF = '__ref.c', AYUDAS = '__ayudas.c', TESTS = '__tests.c', PROGRAMA = '__programa.c';

// Los #define que sacan de la referencia las funciones que el estudiante escribió.
function defines(ej, archivos) {
  const propias = funcionesPropias(ej, archivos[ej.alumno] ?? '');
  return { propias, texto: propias.map(f => `#define ALUMNO_${f} 1\n`).join('') };
}

// Archivos que ve el compilador: los del proyecto, la referencia y las ayudas (ocultos).
function base(ej, archivos, ocultos) {
  const files = { ...archivos };
  files[REF] = ocultos[ej.referencia];
  if (ej.ayudas) files[AYUDAS] = archivos[ej.ayudas] ?? ocultos[ej.ayudas];   // visible (solo lectura) u oculto
  return files;
}

// Programa para los tests: cada test es una función __test_N; se llaman una por una.
export function armarTests(ej, archivos, ocultos, tests) {
  const files = base(ej, archivos, ocultos);
  const d = defines(ej, archivos);
  if (files[ej.alumno] != null) files[ej.alumno] = sinPlantillas(ej, files[ej.alumno]);
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
