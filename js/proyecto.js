// Lógica pura del proyecto (sin DOM): qué funciones escribió el estudiante,
// cómo se arma el programa que se compila y cómo se comparan las salidas.
// Se puede importar desde node para probarla.
import { generarTestArbol, describirTestArbol } from './arbol.js?v=202611191356';
import { generarTestTabla, describirTestTabla } from './tabla.js?v=202611191356';

// Tipo de un campo de struct en ej.estructuras: «Node» (puntero a Node, forma corta), «Pair **»,
// «long», «char *»… → {base, ptr}.
export function tipoCampo(t, est = {}) {
  const m = /^\s*(?:const\s+|unsigned\s+|signed\s+)*([A-Za-z_]\w*)\s*(\**)\s*$/.exec(t ?? '');
  if (!m) return null;
  if (m[2]) return { base: m[1], ptr: m[2].length };
  return { base: m[1], ptr: est[m[1]] || m[1] === 'void' ? 1 : 0 };
}

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
        const f = /([A-Za-z_][\w \t\*]*?[\s\*])([A-Za-z_]\w*)\s*\(((?:[^()]|\([^()]*\))*)\)\s*$/.exec(antes);   // (un nivel de paréntesis adentro: int (*f)(void *))
        if (f) {
          let j = i + 1, p = 1;
          while (j < m.length && p) { if (m[j] === '{') p++; else if (m[j] === '}') p--; j++; }
          const params = !f[3].trim() || f[3].trim() === 'void' ? [] : f[3].split(/,(?![^()]*\))/).map(s => {
            const fp = /\(\s*\*\s*([A-Za-z_]\w*)\s*\)/.exec(s);   // puntero a función: int (*lower_than)(…)
            if (fp) return { nombre: fp[1], base: 'funcion', ptr: 0 };
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
  return nombres.filter(n => new RegExp(`\\b${n}\\s*\\((?:[^;{}()]|\\([^;{}()]*\\))*\\)\\s*\\{`).test(limpio));
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

// El archivo del estudiante con todas las funciones de los pasos ya hechas (las de la referencia,
// lo que está entre #ifndef ALUMNO_f y #endif). Para el modo profesor.
export function solucionCompleta(ej, base, ref) {
  const partes = ej.pasos.map(p => `// ${p.titulo}\n` + p.funciones.map(f => {
    const m = new RegExp(`#ifndef ALUMNO_${f}\\b[^\\n]*\\n([\\s\\S]*?)#endif`).exec(ref ?? '');
    return m ? m[1].trimEnd() + '\n' : p.plantillas[f];
  }).join('\n'));
  return base.trimEnd() + '\n\n' + partes.join('\n');
}

// Agrega al archivo del estudiante las plantillas de las funciones que aún no están
// (todas las del paso, o solo `cuales`).
export function agregarPlantilla(texto, paso, cuales = paso.funciones) {
  const faltan = cuales.filter(f => !funcionesDefinidas(texto, [f]).length);
  if (!faltan.length) return texto;
  const sep = texto.endsWith('\n\n') ? '' : texto.endsWith('\n') ? '\n' : '\n\n';
  return `${texto}${sep}// ${paso.titulo}\n${faltan.map(f => paso.plantillas[f]).join('\n')}`;
}

// Revisión de punteros para los tests: __ck avisa (con una marca en la salida) y detiene el
// programa si se sigue un puntero NULL o con basura. En la visualización la define __vis.c.
const CK = `#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <unistd.h>
void * __ck(void * p, int linea) {
    uintptr_t a = (uintptr_t)p;
    const char * tipo = p == NULL ? "NULL" : (a % sizeof(void *) || a < 4096 || a >= (uintptr_t)sbrk(0)) ? "BASURA" : 0;
    if (tipo) {
        fflush(stdout);
        printf("@@FALLA %d %s\\n", linea, tipo);
        fflush(stdout);
        exit(1);
    }
    return p;
}
`;

// Agrega la revisión de punteros a las funciones que escribió el estudiante.
export function conRevisionDePunteros(ej, texto) {
  for (const f of funcionesPropias(ej, texto)) texto = instrumentarFuncion(texto, f, ej, true, true);
  return texto;
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
// revision: con la revisión de punteros en las funciones del estudiante (si se puede compilar así).
export function armarTests(ej, archivos, ocultos, tests, revision = false) {
  const files = base(ej, archivos, ocultos);
  if (revision && ej.estructuras) {
    files[ej.alumno] = conRevisionDePunteros(ej, files[ej.alumno] ?? '');
    files['__ck.c'] = CK;
  }
  const d = defines(ej, archivos);
  if (files[ej.alumno] != null) files[ej.alumno] = sinPlantillas(ej, files[ej.alumno]);
  files[TESTS] = tests.map((t, i) => `void __test_${i}(void) {\n${t.codigo}\n}\n`).join('\n');
  files[PROGRAMA] = (files['__ck.c'] ? 'void * __ck(void *, int);\n' : '') + `${d.texto}#include "${ej.alumno}"\n#include "${REF}"\n` + (files['__ck.c'] ? '#include "__ck.c"\n' : '') +
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

// ---------- Visualización ----------

// ---- Instrumentación para dibujar: se agregan llamadas de volcado sin agregar líneas ----

// Pone el volcado `dv` (una instrucción, termina en ;) en una línea que es una instrucción.
// L: la línea; m: la misma enmascarada (sin comentarios ni textos). Devuelve la línea nueva o null.
// La instrucción se envuelve en llaves junto al volcado, para que quede dentro de un if/else o de
// un ciclo sin llaves: «else x = 1;» → «else { x = 1; volcado }». Las declaraciones no se envuelven
// (cambiaría su alcance) y antes de un return el volcado va primero.
// ret (opcional): {tipo, dv} para guardar lo que retorna en __r y volcarlo antes de retornar.
function conVolcado(L, m, dv, pre = '', ret = null) {
  const p_ = pre ? pre + ' ' : '';
  const t = m.trim();
  const ini = m.length - m.trimStart().length, fin = m.trimEnd().length;
  if (t.endsWith('}') && !t.endsWith(';')) {   // termina un bloque: el volcado va después
    let p = 0; for (const ch of m) { if (ch === '{') p++; else if (ch === '}') p--; }
    // un bloque en una línea («if (c) { a; b; }»): el volcado va adentro, antes de la } (después podría venir un else)
    if (p === 0 && m.includes('{') && t !== '}') return `${L.slice(0, fin - 1)}${dv} ${L.slice(fin - 1)}`;
    return p === 0 || t === '}' ? `${L.slice(0, fin)} ${dv}${L.slice(fin)}` : null;
  }
  if (!t.endsWith(';')) return null;
  // prefijo de control: «} else», «if (...)», «while (...)», «for (...)» (puede haber varios: «else if (c)»)
  let a = ini;
  for (;;) {
    const r = /^(\}\s*)?else\b\s*/.exec(m.slice(a, fin)) ?? /^(if|while|for)\s*\(/.exec(m.slice(a, fin));
    if (!r) break;
    if (r[0].endsWith('(')) {   // hasta el ) que cierra la condición
      let p = 1, k = a + r[0].length;
      for (; k < fin && p; k++) { if (m[k] === '(') p++; else if (m[k] === ')') p--; }
      if (p) break;
      a = k; while (m[a] === ' ' || m[a] === '\t') a++;
    } else a += r[0].length;
  }
  const prefijo = m.slice(ini, a), cuerpo = m.slice(a, fin);
  if (!cuerpo) return null;
  // varias instrucciones o llaves en medio: no se toca (sería fácil romperla)
  const fuera = cuerpo.replace(/\([^()]*\)/g, '').replace(/\([^()]*\)/g, '');
  if ((fuera.match(/;/g) || []).length > 1 || /[{}]/.test(fuera.slice(1)) || /\belse\b/.test(fuera)) return null;
  if (/^\}\s*while\b/.test(cuerpo)) return `${L.slice(0, fin)} ${dv}${L.slice(fin)}`;   // fin de un do-while
  const esDecl = /^((const|struct|unsigned|signed)\s+)*[A-Za-z_]\w*(\s+|\s*\*+\s*)[A-Za-z_]\w*\s*(=|;|,|\[)/.test(cuerpo) && !/^(return|else|do|goto)\b/.test(cuerpo);
  if (/^return\b/.test(cuerpo)) {
    const expr = L.slice(a, fin).replace(/^return\b/, '').replace(/;\s*$/, '').trim();
    if (ret && expr) return `${L.slice(0, a)}{ ${ret.tipo} __r = (${expr}); ${ret.dv} ${p_}return __r; }${L.slice(fin)}`;
    return `${L.slice(0, a)}{ ${dv} ${p_}${L.slice(a, fin)} }${L.slice(fin)}`;
  }
  if (prefijo) return `${L.slice(0, a)}{ ${p_}${L.slice(a, fin)} ${dv} }${L.slice(fin)}`;
  if (cuerpo.startsWith('}')) return `${L.slice(0, fin)} ${dv}${L.slice(fin)}`;
  if (esDecl) return `${L.slice(0, a)}${p_}${L.slice(a, fin)} ${dv}${L.slice(fin)}`;
  return `${L.slice(0, a)}{ ${p_}${L.slice(a, fin)} ${dv} }${L.slice(fin)}`;
}

// Pone la expresión de volcado `ex` en la condición de un for/while de la línea, para que se
// ejecute cada vez que se evalúa: «for (a; c; i)» → «for (a; (ex, c); i)», «while (c)» → «while ((ex, c))».
function condicionConVolcado(L, m, ex, soloIf = null) {
  const r = /\b(for|while|if)\s*\(/.exec(m);
  if (r && r[1] === 'if') {   // en un if solo va la marca de línea (no un dibujo)
    if (!soloIf) return null;
    const p0 = r.index + r[0].length - 1;
    let p = 0, pc = -1;
    for (let k = p0; k < m.length; k++) { if (m[k] === '(') p++; else if (m[k] === ')' && !--p) { pc = k; break; } }
    return pc < 0 ? null : `${L.slice(0, p0 + 1)}(${soloIf}, ${L.slice(p0 + 1, pc)})${L.slice(pc)}`;
  }
  if (!r || (r[1] === 'while' && /^\s*\}/.test(m) && m.trimEnd().endsWith(';'))) return null;   // no el while de un do-while
  const p0 = r.index + r[0].length - 1;
  let p = 0, pc = -1;
  const pc0 = [];
  for (let k = p0; k < m.length; k++) {
    if (m[k] === '(') p++;
    else if (m[k] === ')') { p--; if (!p) { pc = k; break; } }
    else if (m[k] === ';' && p === 1) pc0.push(k);
  }
  if (pc < 0) return null;
  if (r[1] === 'while') return `${L.slice(0, p0 + 1)}(${ex}, ${L.slice(p0 + 1, pc)})${L.slice(pc)}`;
  if (pc0.length !== 2) return null;
  const [s1, s2] = pc0;
  if (!m.slice(s1 + 1, s2).trim()) return `${L.slice(0, s1 + 1)} (${ex}, 1)${L.slice(s2)}`;
  return `${L.slice(0, s1 + 1)} (${ex}, ${L.slice(s1 + 1, s2).trim()})${L.slice(s2)}`;
}

// Revisión de punteros: en la línea, cada «a->campo» (con «a» de un tipo conocido: List *, Node *…)
// pasa a «((Tipo *)__ck((void *)(a), n))->campo», que detiene el programa si «a» es NULL, basura o
// un nodo liberado (el intérprete no siempre lo detecta). tipos: Map variable → tipo; est: los structs.
export function conRevision(L, n, tipos, est) {
  const m = enmascarar(L);
  const cambios = [];
  for (const r of m.matchAll(/\b([A-Za-z_]\w*)((?:\s*->\s*[A-Za-z_]\w*|\s*\[[^\[\]]*\])+)/g)) {
    if (/(->|\.)\s*$/.test(m.slice(0, r.index))) continue;   // es parte de otra expresión
    const t0 = tipos.get(r[1]);
    let tipo = t0 && est[t0] ? { base: t0, ptr: 1 } : null;
    if (!tipo || !/->/.test(r[2])) continue;
    let expr = r[1], pos = r.index + r[1].length;
    for (const seg of r[2].matchAll(/\s*->\s*([A-Za-z_]\w*)|\s*\[[^\[\]]*\]/g)) {
      const original = L.slice(pos + seg.index, pos + seg.index + seg[0].length);   // con sus textos
      if (seg[1]) {   // ->campo
        if (tipo && tipo.ptr === 1 && est[tipo.base]) {
          expr = `((${tipo.base} *)__ck((void *)(${expr}), ${n}))->${seg[1]}`;
          tipo = tipoCampo(est[tipo.base][seg[1]], est);
        } else { expr += original; tipo = null; }
      } else {   // [índice]
        expr += original;
        tipo = tipo && tipo.ptr > 1 ? { base: tipo.base, ptr: tipo.ptr - 1 } : null;
      }
    }
    cambios.push([r.index, r.index + r[0].length, expr]);
  }
  for (const [a, b, e] of cambios.reverse()) L = L.slice(0, a) + e + L.slice(b);
  return L;
}

// Test: agrega «__volcar(n, L)» después de cada instrucción (desde que L existe) y en la condición
// de cada for/while (con -n). n es el número de línea del test (desde 1).
export function instrumentar(codigo, variable) {
  const lineas = codigo.split('\n'), m = enmascarar(codigo).split('\n');
  const decl = new RegExp(`\\b[A-Za-z_]\\w*\\s*\\*\\s*${variable}\\b`);
  let existe = false;
  return lineas.map((l, i) => {
    // __voy(n): «ahora se ejecuta la línea n» (si el programa se cae, la última marca dice dónde)
    if (!existe && decl.test(m[i])) { existe = true; return conVolcado(l, m[i], `__volcar(${i + 1}, ${variable});`, `__voy(${i + 1});`) ?? l; }
    if (!existe) return l;
    let L = l, M = m[i];
    const c = condicionConVolcado(L, M, `__voy(${i + 1}), __volcar(-${i + 1}, ${variable})`, `__voy(${i + 1})`);
    if (c) { L = c; M = enmascarar(c); }
    return conVolcado(L, M, `__volcar(${i + 1}, ${variable});`, `__voy(${i + 1});`) ?? L;
  }).join('\n');
}

// Agrega volcados dentro de la función `nombre` del estudiante: al entrar, después de cada
// instrucción (antes de cada return) y en la condición de cada for/while, con la lista y las
// variables Node * visibles. No agrega líneas: los números de línea de list.c siguen valiendo.
// soloRevision: no agrega volcados ni marcas, solo la revisión de punteros (para los tests).
export function instrumentarFuncion(texto, nombre, ej, revisar = true, soloRevision = false) {
  const fn = funcionesDelArchivo(texto).find(f => f.nombre === nombre);
  if (!fn) return texto;
  const v = ej.visual, nodo = Object.keys(ej.estructuras ?? {}).find(t => t !== v.tipo);
  const lineas = texto.split('\n'), m = enmascarar(texto).split('\n');
  const lineaDe = pos => texto.slice(0, pos).split('\n').length - 1;   // 0-based
  const l0 = lineaDe(fn.cuerpo), l1 = lineaDe(fn.fin);
  // variables visibles: [{nombre, tipo, prof, clase}]; clase: lista, nodo, dato (void *), int, double
  const extra = v.clases ?? {};   // otros punteros que se vuelcan con su propio código (Pair * en el árbol: 5)
  const clase = (base, ptr) => ptr === 1 ? (base === v.tipo ? 'lista' : base === nodo ? 'nodo' : extra[base] != null ? `extra:${base}` : base === 'void' ? 'dato' : base === 'char' && v.textos ? 'texto' : null)
    : ptr === 0 ? (/^(int|long|short|char|unsigned|signed)$/.test(base) ? 'int' : /^(double|float)$/.test(base) ? 'double' : null) : null;
  let vars = fn.params.map(q => ({ nombre: q.nombre, tipo: q.base, prof: 0, clase: clase(q.base, q.ptr) })).filter(x => x.clase);
  const CODIGO = { nodo: 0, dato: 1, int: 2, double: 3, texto: 4 };
  const codigo = c => c.startsWith('extra:') ? extra[c.slice(6)] : CODIGO[c];
  const arg = (x, valor = x.nombre) => `, ${codigo(x.clase)}, "${x.nombre}", ${x.clase === 'int' ? `(long)(${valor})` : x.clase === 'double' ? `(double)(${valor})` : `(void *)(${valor})`}`;
  const volcado = (n, extra = []) => {   // una expresión (sirve también dentro de una condición)
    const lista = [...vars].reverse().find(x => x.clase === 'lista')?.nombre ?? `(${v.tipo} *)0`;
    const vs = vars.filter(x => x.clase !== 'lista').slice(-14);
    return `__volcarv(${n}, ${lista}, ${vs.length + extra.length}${vs.map(x => arg(x)).join('')}${extra.map(x => arg(x, x.valor)).join('')})`;
  };
  // lo que retorna la función: se guarda en __r y se muestra como «return»
  const r = fn.retorno, claseRet = clase(r.base, r.ptr);
  const tipoRet = claseRet && claseRet !== 'lista' ? `${r.base} ${'*'.repeat(r.ptr)}`.trim() : null;
  const decl = new RegExp(`\\b(?:const\\s+|unsigned\\s+|signed\\s+)?(${[v.tipo, nodo, ...Object.keys(extra)].join('|')}|void|int|long|short|char|double|float)\\s*(\\**)\\s*([A-Za-z_]\\w*)\\s*(?=[=;,])`, 'g');
  if (l0 === l1) {   // toda la función en una línea: solo se revisan sus punteros
    if (!revisar) return texto;
    const ini = fn.cuerpo - (texto.lastIndexOf('\n', fn.cuerpo - 1) + 1), fin = ini + (fn.fin - fn.cuerpo);
    const L = lineas[l0];
    lineas[l0] = L.slice(0, ini) + conRevision(L.slice(ini, fin), l0 + 1, new Map(vars.map(x => [x.nombre, x.tipo])), ej.estructuras ?? {}) + L.slice(fin);
    return lineas.join('\n');
  }
  let prof = 1;
  for (let i = l0; i < l1; i++) {
    let linea = m[i];
    if (i === l0) {   // la línea de la cabecera: el volcado «al entrar» va justo después de la {
      const c = fn.cuerpo - (texto.lastIndexOf('\n', fn.cuerpo - 1) + 1);
      if (!soloRevision) lineas[i] = lineas[i].slice(0, c) + ' ' + volcado(i + 1) + ';' + lineas[i].slice(c);
      linea = m[i].slice(c);
    }
    const antes = prof;
    const sinParentesis = linea.replace(/\([^()]*\)/g, x => ' '.repeat(x.length)).replace(/\([^()]*\)/g, x => ' '.repeat(x.length));
    const nuevas = [...sinParentesis.matchAll(decl)].map(r => ({ nombre: r[3], tipo: r[1], prof: antes, clase: clase(r[1], r[2].length) }))
      .filter(x => x.clase && !/^(return|sizeof)$/.test(x.nombre));   // no las de un for (...)
    if (i === l0 || !linea.trim()) {
      vars.push(...nuevas);
      if (i === l0 && revisar && linea.trim()) {   // función en una sola línea: igual se revisan sus punteros
        const c = lineas[i].length - linea.length;
        lineas[i] = lineas[i].slice(0, c) + conRevision(lineas[i].slice(c), i + 1, new Map(vars.map(x => [x.nombre, x.tipo])), ej.estructuras ?? {});
      }
      continue;
    }
    // la variable de un for (for (long i = …; …) {): se ve dentro del ciclo, también en su condición
    const vFor = /\bfor\s*\(\s*(?:const\s+|unsigned\s+|signed\s+)?(int|long|short|size_t)\s+([A-Za-z_]\w*)\s*=/.exec(linea);
    if (vFor && /\{\s*$/.test(linea)) vars.push({ nombre: vFor[2], tipo: vFor[1], prof: antes + 1, clase: 'int' });
    let L = lineas[i], M = m[i];
    const c = soloRevision ? null : condicionConVolcado(L, M, `__voyf(${i + 1}), ${volcado(-(i + 1))}`, `__voyf(${i + 1})`);
    if (c) { L = c; M = enmascarar(c); }
    for (const ch of linea) { if (ch === '{') prof++; else if (ch === '}') { prof--; vars = vars.filter(x => x.prof <= prof); } }
    vars.push(...nuevas);   // después de la línea que las declara
    const ret = tipoRet ? { tipo: tipoRet, dv: volcado(i + 1, [{ nombre: 'return', clase: claseRet, valor: '__r' }]) + ';' } : null;
    // después de una } que sigue con un else en la línea siguiente no se puede poner nada
    const sigueElse = /\}\s*$/.test(M) && /^\s*else\b/.test(m.slice(i + 1).find(x => x.trim()) ?? '');
    lineas[i] = soloRevision || sigueElse ? L : conVolcado(L, M, volcado(i + 1) + ';', `__voyf(${i + 1});`, ret) ?? L;
    if (revisar) lineas[i] = conRevision(lineas[i], i + 1, new Map(vars.map(x => [x.nombre, x.tipo])), ej.estructuras ?? {});
  }
  return lineas.join('\n');
}

// Programa para dibujar un test: como armarTests, con el volcado y el test instrumentado.
// detalle: funciones del estudiante para dibujar también por dentro (lista de nombres, o null).
export function armarVisual(ej, archivos, ocultos, test, detalle = null) {
  const v = ej.visual;
  const t = { ...test, codigo: `int __volcar(int, ${v.tipo} *);\n${instrumentar(test.codigo, v.variable)}` };   // (los prototipos de __voy van en __programa.c)
  let alumno = archivos[ej.alumno] ?? '';
  for (const f of [].concat(detalle ?? [])) alumno = instrumentarFuncion(alumno, f, ej);
  const conDetalle = detalle ? { ...archivos, [ej.alumno]: alumno } : archivos;
  const prog = armarTests(ej, conDetalle, ocultos, [t]);
  prog.files['__vis.c'] = ocultos[v.archivo];
  const h = ej.archivos.find(a => a.nombre.endsWith('.h'))?.nombre;
  // malloc/calloc/free pasan por __vis.c, para saber qué nodos se liberaron
  prog.files['__programa.c'] = (h ? `#include "${h}"\n` : '') + `int __volcarv(int, ${v.tipo} *, int, ...);\n`
    + 'int __voy(int);\nint __voyf(int);\nvoid * __ck(void *, int);\n'
    + 'void __liberar(void *);\nvoid * __reservar(unsigned long);\nvoid * __reservarc(unsigned long, unsigned long);\n'
    + '#define free(p) __liberar(p)\n#define malloc(n) __reservar(n)\n#define calloc(a, b) __reservarc(a, b)\n'
    + prog.files['__programa.c'] + '#include "__vis.c"\n';
  return prog;
}

// Separa la salida del programa de los volcados y las marcas: {salida, ultima, cuadros: [{dentro, linea, estado, salida}]}
// (dentro: el volcado es de adentro de la función del estudiante, y linea es de list.c;
// salida: lo que el programa había impreso hasta ese momento).
export function leerVolcados(stdout) {
  const cuadros = [], lineas = (stdout ?? '').split('\n');
  let out = '', ultima = null, falla = null;
  lineas.forEach((l, k) => {
    const fa = /@@FALLA (\d+) (\w+)$/.exec(l);   // __ck detuvo el programa
    if (fa) { out += l.slice(0, fa.index); falla = { dentro: true, linea: +fa[1], tipo: fa[2] }; return; }
    const mk = /@@(LF?) (\d+)$/.exec(l);   // marca «ahora se ejecuta la línea n»
    if (mk) { out += l.slice(0, mk.index); ultima = { dentro: mk[1] === 'LF', linea: +mk[2] }; return; }
    const i = l.search(/@@VISF? -?\d+ \{/);   // puede venir después de un printf sin \n
    if (i < 0) { out += l + (k < lineas.length - 1 ? '\n' : ''); return; }
    out += l.slice(0, i);
    const m = /^@@(VISF?) (-?\d+) (.*)$/.exec(l.slice(i));
    try { cuadros.push({ dentro: m[1] === 'VISF', linea: Math.abs(+m[2]), condicion: +m[2] < 0, estado: JSON.parse(m[3]), salida: out }); } catch { /* volcado cortado */ }
  });
  return { salida: out, cuadros, ultima: falla ?? ultima, falla };   // ultima: la última línea que empezó a ejecutarse
}

// ---------- Tests declarativos (listas) ----------
// Un test se describe con datos, no con código:
//   entrada: {lista: [1, 2, 3] (o null: la lista la crea la primera llamada, p. ej. createList), current: 1 (posición)}
//   llamadas: [["popCurrent"], ["pushFront", 7], ...]   (la función y su argumento entero, si tiene)
//   salida: {retornos: [2, null, ...] (uno por cada llamada que retorna algo), lista: [1, 3], current: 3 o null}
// Si salida no trae current, no se revisa dónde queda.

// Tipo de retorno de cada función del .h: Map nombre → «void», «void *», «List *»…
export function retornosDelH(h) {
  const m = new Map();
  for (const r of sinComentarios(h ?? '').matchAll(/(?:^|[;}\n])\s*([A-Za-z_][\w \t*]*?[\s*])([A-Za-z_]\w*)\s*\((?:[^;{()]|\([^;{()]*\))*\)\s*;/g))
    m.set(r[2], r[1].replace(/\s+/g, ' ').replace(/\s*\*\s*/g, ' *').trim());
  return m;
}

const valorTexto = v => v === null || v === undefined ? 'NULL' : String(v);

// {codigo, esperado} de un test declarativo.
export function generarTest(t, retornos, variable = 'L') {
  const e = t.entrada ?? {}, s = t.salida ?? {};
  const lineas = [];
  if (e.lista === null || e.lista === undefined) {   // la lista la crea la primera llamada
    lineas.push('ensuciarMemoria();   // memoria con basura: se nota si algo no se inicializa');
  } else if (e.lista.length) {
    lineas.push(`int v[] = {${e.lista.join(', ')}};`, `List * ${variable} = listaCon(${e.lista.length}, v);`);
  } else lineas.push(`List * ${variable} = listaCon(0, NULL);   // lista vacía`);
  if (Number.isInteger(e.current)) lineas.push(`irA(${variable}, ${e.current});   // current en el ${e.lista[e.current]}`);
  const esperado = [];
  let k = 0, creada = !(e.lista === null || e.lista === undefined);
  for (const [f, arg] of t.llamadas ?? []) {
    const tipo = retornos.get(f) ?? 'void';
    const args = [creada ? variable : null, arg !== undefined ? `entero(${arg})` : null].filter(Boolean).join(', ');
    if (/^List \*$/.test(tipo)) { lineas.push(`List * ${variable} = ${f}(${args});`); creada = true; }
    else if (tipo === 'void') lineas.push(`${f}(${args});`);
    else { lineas.push(`retorno(${f}(${args}));`); esperado.push(`retorna: ${valorTexto(s.retornos?.[k++])}`); }
  }
  const conCurrent = 'current' in s;
  lineas.push(`resultado(${variable}, ${conCurrent ? 1 : 0});`);
  const lista = s.lista ?? [];
  esperado.push(`lista: [${lista.join(', ')}]`,
    `head: ${valorTexto(lista[0])}, tail: ${valorTexto(lista.at(-1))}` + (conCurrent ? `, current: ${valorTexto(s.current)}` : ''),
    'enlaces: bien');
  return { codigo: lineas.join('\n'), esperado: esperado.join('\n') };
}

// Parámetros de cada función del .h (prototipos y definiciones): Map nombre → [{nombre, base, ptr}].
export function parametrosDelH(h) {
  const m = new Map();
  const t = sinComentarios(h ?? '');
  for (const r of t.matchAll(/(?:^|[;}\n])\s*[A-Za-z_][\w \t*]*?[\s*]([A-Za-z_]\w*)\s*\(((?:[^;{()]|\([^;{()]*\))*)\)\s*[;{]/g)) {
    if (m.has(r[1])) continue;
    const ps = !r[2].trim() || r[2].trim() === 'void' ? [] : r[2].split(/,(?![^()]*\))/).map(x => {
      const fp = /\(\s*\*\s*([A-Za-z_]\w*)\s*\)/.exec(x);
      if (fp) return { nombre: fp[1], base: 'funcion', ptr: 0 };
      const q = /^(.*?)([A-Za-z_]\w*)\s*$/.exec(x.trim());
      return q ? { nombre: q[2], base: q[1].replace(/\b(const|struct|unsigned|signed)\b|\*/g, '').trim(), ptr: (q[1].match(/\*/g) || []).length } : null;
    }).filter(Boolean);
    m.set(r[1], ps);
  }
  return m;
}

// Las entradas de la llamada de un test, como variables para dibujar (key = 7010, key = "gato", data = 7, x → nodo):
// los argumentos de la primera llamada con el nombre de su parámetro (sin el de la estructura: tree, map, list).
export function entradasDe(t, params, tipoEstructura) {
  const [f, ...args] = t.llamadas?.[0] ?? [];
  const ps = (params.get(f) ?? []).filter(p => !(p.base === tipoEstructura && p.ptr === 1));
  return ps.map((p, i) => {
    const a = args[i];
    if (a === undefined) return null;
    if (typeof a === 'string' && /^root\b/.test(a)) return { nombre: p.nombre, ruta: a };   // un nodo del árbol: minimum(tree->root->left)
    if ((p.base === 'char' && p.ptr === 1) || typeof a === 'string') return { nombre: p.nombre, texto: { t: String(a) } };
    if (p.ptr === 0) return { nombre: p.nombre, valor: a };
    return { nombre: p.nombre, dato: a };   // void *: el valor al que apunta
  }).filter(Boolean);
}

// Genera el código y la salida esperada de los tests declarativos del ejercicio.
export function prepararTests(ej, archivos) {
  const h = Object.entries(archivos).find(([n]) => n.endsWith('.h'))?.[1];
  const retornos = retornosDelH(h);
  const gen = ej.modelo === 'tabla' ? generarTestTabla : ej.modelo === 'arbol' ? generarTestArbol : generarTest;
  const params = parametrosDelH(h);
  for (const p of ej.pasos) for (const t of p.tests) if (t.llamadas) Object.assign(t, gen(t, retornos, ej.visual?.variable ?? 'L'), { modelo: ej.modelo ?? 'lista', variable: ej.visual?.variable ?? 'L', entradas: entradasDe(t, params, ej.visual?.tipo) });
}

// Descripción corta de un test declarativo (para mostrarlo en vez del código).
export function describirTest(t, ej = null) {
  if (!t.llamadas) return null;
  if ((ej?.modelo ?? t.modelo) === 'tabla') return describirTestTabla(t);
  if ((ej?.modelo ?? t.modelo) === 'arbol') return describirTestArbol(t);
  const e = t.entrada ?? {}, s = t.salida ?? {};
  const lista = l => `[${(l ?? []).join(', ')}]`;
  const entrada = e.lista === null || e.lista === undefined ? 'sin lista'
    : `${lista(e.lista)}${Number.isInteger(e.current) ? `, current en ${e.lista[e.current]}` : ''}`;
  const llamadas = t.llamadas.map(([f, a]) => `${f}(${a !== undefined ? a : ''})`).join(', ');
  const rets = (s.retornos ?? []).map(valorTexto);
  const salida = (rets.length ? `retorna ${rets.join(', ')}; ` : '') + `queda ${lista(s.lista)}` + ('current' in s ? `, current en ${valorTexto(s.current)}` : '');
  return { entrada, llamadas, salida };
}
