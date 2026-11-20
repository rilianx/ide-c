// Asistente de comandos para el archivo del estudiante (como en Puntero C):
// se elige la función que se implementa y se arman líneas eligiendo piezas
// (variables y campos que existen en ese punto, del tipo que corresponde).
// También se puede escribir con el teclado: el asistente solo inserta líneas.
import { funcionEn, funcionesDelArchivo, variablesEn, funcionesDefinidas, agregarPlantilla, enmascarar, tipoCampo } from './proyecto.js?v=202611202011';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const T = (base, ptr = 1) => ({ base, ptr });
const nombreTipo = t => t.ptr ? `${t.base} *` : t.base;
const NUM = /^(int|long|short|unsigned|signed|char|size_t)$/;
const esNum = t => t && t.ptr === 0 && NUM.test(t.base);
// mismo tipo (los enteros entre sí cuentan como iguales)
const mismo = (a, b) => a && b && a.ptr === b.ptr && (a.base === b.base || (esNum(a) && esNum(b)));

// Expresiones disponibles: variables (punteros y enteros) y sus campos (hasta dos niveles:
// aux->next->data), y las casillas de un arreglo de punteros con cada índice entero (map->buckets[pos]->key).
function expresiones(vars, est) {
  const out = [];
  const indices = vars.filter(v => esNum(v)).map(v => v.nombre);
  const camposDe = (texto, base, desde) => {   // los campos de un struct al que se llega con `texto`
    for (const [c2, t2] of Object.entries(est[base] ?? {})) { const tb2 = tipoCampo(t2, est); if (tb2) out.push({ texto: `${texto}->${c2}`, ...tb2 }); }
  };
  const casillas = (texto, base) => { for (const ix of indices) { out.push({ texto: `${texto}[${ix}]`, ...T(base) }); camposDe(`${texto}[${ix}]`, base); } };
  for (const v of vars) {
    if (!v.ptr) { if (esNum(v)) out.push({ texto: v.nombre, ...T(v.base, 0) }); continue; }
    out.push({ texto: v.nombre, ...T(v.base, v.ptr) });
    if (v.ptr === 2 && est[v.base]) { casillas(v.nombre, v.base); continue; }   // Pair ** old_buckets
    const campos = v.ptr === 1 ? est[v.base] : null;
    if (!campos) continue;
    for (const [c, ts] of Object.entries(campos)) {
      const tb = tipoCampo(ts, est);
      if (!tb) continue;
      out.push({ texto: `${v.nombre}->${c}`, ...tb });
      if (tb.ptr === 2 && est[tb.base]) casillas(`${v.nombre}->${c}`, tb.base);   // map->buckets[pos]
      // dos niveles solo desde un contenedor (list->head->next), no nodo→nodo→nodo
      else if (tb.ptr === 1 && est[tb.base] && tb.base !== v.base) camposDe(`${v.nombre}->${c}`, tb.base);
    }
  }
  return out;
}

// Nombres de variables que usa el código base del ejercicio (.h y código del curso), por tipo:
// {List: ['list', ...], Node: ['nuevo', 'aux', ...], void: ['data', ...]}, los más usados primero.
function nombresDelCodigo(textos, tipos, campos = new Set()) {
  const cuenta = new Map();
  const re = new RegExp(`\\b(${tipos.join('|')})\\s*\\*\\s*([A-Za-z_]\\w*)\\s*(?=[=;,)\\[])`, 'g');
  for (const t of textos) for (const m of (t ?? '').replace(/\/\/[^\n]*/g, '').matchAll(re)) {
    if (m[2].startsWith('__') || tipos.includes(m[2]) || campos.has(m[2])) continue;   // no los campos de los structs
    const c = cuenta.get(m[1]) ?? new Map();
    c.set(m[2], (c.get(m[2]) ?? 0) + 1);
    cuenta.set(m[1], c);
  }
  return Object.fromEntries(tipos.map(t => [t, [...(cuenta.get(t) ?? new Map())].sort((a, b) => b[1] - a[1]).map(([n]) => n)]));
}
const juntar = (...listas) => [...new Set(listas.flat())];

// Plantillas: huecos que se llenan en orden; cada uno sabe qué piezas acepta.
//   nombre: un nombre nuevo · lval: algo asignable · expr: una expresión (de tipo dado) · ret: lo que retorna la función
function plantillas(est, ctors, retorno, nombres = {}, llamadas = [], comandos = []) {
  const structs = Object.keys(est);
  const out = [];
  // ¿hay campos enteros o arreglos (tabla hash)? → plantillas para índices, hash, calloc…
  const tipos = Object.values(est).flatMap(c => Object.values(c).map(t => tipoCampo(t, est)));
  const conNumeros = tipos.some(t => t && t.ptr === 0), arreglos = tipos.filter(t => t && t.ptr === 2 && est[t.base]);
  const LONG = () => T('long', 0);
  const sug = (tipo, extra) => juntar(nombres[tipo] ?? [], extra).slice(0, 8);
  for (const s of structs) out.push({
    cat: 'Variables', etiqueta: `${s} * _ = _;`, clase: 'decl',
    huecos: [{ k: 'nombre', sug: sug(s, s === 'List' ? ['lista', 'l'] : ['nuevo', 'aux', 'actual', 'sig', 'ant', 'n']) }, { k: 'expr', tipo: () => T(s) }],
    armar: v => [`${s} * ${v[0].texto} = ${v[1].texto};`],
  });
  out.push({
    cat: 'Variables', etiqueta: 'void * _ = _;', clase: 'decl',
    huecos: [{ k: 'nombre', sug: sug('void', ['dato', 'd']) }, { k: 'expr', tipo: () => T('void') }],
    armar: v => [`void * ${v[0].texto} = ${v[1].texto};`],
  });
  out.push({
    cat: 'Asignar', etiqueta: '_ = _;',
    huecos: [{ k: 'lval' }, { k: 'expr', tipo: v => T(v[0].base, v[0].ptr), calculos: true }],
    armar: v => [`${v[0].texto} = ${v[1].texto};`],
  });
  for (const s of structs) out.push({
    cat: 'Memoria', etiqueta: `${s} * _ = malloc(sizeof(${s}));`, clase: 'mem',
    huecos: [{ k: 'nombre', sug: sug(s, s === 'List' ? ['lista', 'l'] : ['nuevo', 'n']) }],
    armar: v => [`${s} * ${v[0].texto} = (${s} *)malloc(sizeof(${s}));`],
  });
  for (const c of ctors) {
    const ps = (c.params ?? [c.param]).map(p => tipoCampo(p, est) ?? T(p));
    const huecosPs = ps.map(t => ({ k: 'expr', tipo: () => t }));
    const llamada = v => `${c.nombre}(${v.map(x => x.texto).join(', ')})`;
    out.push({
      cat: 'Memoria', etiqueta: `${c.tipo} * _ = ${c.nombre}(${ps.map(() => '_').join(', ')});`, clase: 'mem',
      huecos: [{ k: 'nombre', sug: sug(c.tipo, ['nuevo', 'n', 'aux', 'par']) }, ...huecosPs],
      armar: v => [`${c.tipo} * ${v[0].texto} = ${llamada(v.slice(1))};`],
    });
    if (c.params) out.push({
      cat: 'Memoria', etiqueta: `_ = ${c.nombre}(${ps.map(() => '_').join(', ')});`, clase: 'mem',
      huecos: [{ k: 'lval', tipo: () => T(c.tipo) }, ...huecosPs],
      armar: v => [`${v[0].texto} = ${llamada(v.slice(1))};`],
    });
  }
  if (conNumeros) {
    out.push({ cat: 'Variables', etiqueta: 'long _ = _;', clase: 'decl',
      huecos: [{ k: 'nombre', sug: sug('long', ['pos', 'i', 'old_capacity']) }, { k: 'expr', tipo: LONG }],
      armar: v => [`long ${v[0].texto} = ${v[1].texto};`] });
    out.push({ cat: 'Variables', etiqueta: 'long _ = hash(_, _);', clase: 'decl',
      huecos: [{ k: 'nombre', sug: sug('long', ['pos', 'i']) }, { k: 'expr', tipo: () => T('char') }, { k: 'expr', tipo: LONG }],
      armar: v => [`long ${v[0].texto} = hash(${v[1].texto}, ${v[2].texto});`] });
    for (const a of arreglos) out.push({ cat: 'Variables', etiqueta: `${a.base} ** _ = _;`, clase: 'decl',
      huecos: [{ k: 'nombre', sug: sug(a.base, ['old_buckets', 'viejo']) }, { k: 'expr', tipo: () => T(a.base, 2) }],
      armar: v => [`${a.base} ** ${v[0].texto} = ${v[1].texto};`] });
    out.push({ cat: 'Asignar', etiqueta: '_++;', huecos: [{ k: 'lval', num: true }], armar: v => [`${v[0].texto}++;`] });
    out.push({ cat: 'Asignar', etiqueta: '_--;', huecos: [{ k: 'lval', num: true }], armar: v => [`${v[0].texto}--;`] });
    for (const a of arreglos) out.push({ cat: 'Memoria', etiqueta: `_ = calloc(_, sizeof(${a.base} *));`, clase: 'mem',
      huecos: [{ k: 'lval', tipo: () => T(a.base, 2) }, { k: 'expr', tipo: LONG }],
      armar: v => [`${v[0].texto} = (${a.base} **)calloc(${v[1].texto}, sizeof(${a.base} *));`] });
    out.push({ cat: 'Control', etiqueta: 'if (is_equal(_, _)) { … }', huecos: [{ k: 'expr', tipo: () => T('char') }, { k: 'expr', tipo: () => T('char') }],
      armar: v => [`if (is_equal(${v[0].texto}, ${v[1].texto})) {`, '', '}'], dentro: 1 });
    out.push({ cat: 'Control', etiqueta: 'for (long i = _; i < _; i++) { … }', huecos: [{ k: 'expr', tipo: LONG, masUno: true }, { k: 'expr', tipo: LONG }],
      armar: v => [`for (long i = ${v[0].texto}; i < ${v[1].texto}; i++) {`, '', '}'], dentro: 1 });
    out.push({ cat: 'Control', etiqueta: 'if (_ > 0.7 * _) { … }', huecos: [{ k: 'expr', tipo: LONG }, { k: 'expr', tipo: LONG }],
      armar: v => [`if (${v[0].texto} > 0.7 * ${v[1].texto}) {`, '', '}'], dentro: 1 });
  }
  // comandos propios del ejercicio (ejercicio.json → comandos): «if (is_equal(⟨TreeMap *⟩, ⟨void *⟩, ⟨void *⟩)) {»
  // cada ⟨tipo⟩ es un hueco de ese tipo; con bloque, se cierra con }
  for (const c of comandos) {
    const partes = c.texto.split(/⟨([^⟩]*)⟩/), tipos = partes.filter((_, i) => i % 2);
    const huecos = tipos.map(t => { const tp = tipoCampo(t, est) ?? T(t); return { k: 'expr', tipo: () => tp }; });
    const llenar = v => partes.map((p, i) => i % 2 ? v[(i - 1) / 2].texto : p).join('');
    out.push({ cat: c.cat ?? 'Control', etiqueta: partes.map((p, i) => i % 2 ? '_' : p).join('') + (c.bloque ? ' … }' : ''), huecos,
      armar: v => c.bloque ? [llenar(v), '', '}'] : [llenar(v)], ...(c.bloque ? { dentro: 1 } : {}) });
  }
  // llamadas a otras funciones del ejercicio (enlarge(map), insertMap(map, k, v), searchMap…)
  for (const f of llamadas) {
    const ps = f.params.map(p => tipoCampo(p, est) ?? T(p)), huecos = ps.map(t => ({ k: 'expr', tipo: () => t }));
    const ret = f.retorno && tipoCampo(f.retorno, est);
    const args = v => v.map(x => x.texto).join(', ');
    if (ret && ret.ptr) out.push({ cat: 'Llamar', etiqueta: `${ret.base} * _ = ${f.nombre}(${ps.map(() => '_').join(', ')});`, clase: 'decl',
      huecos: [{ k: 'nombre', sug: sug(ret.base, ['par', 'aux']) }, ...huecos], armar: v => [`${ret.base} * ${v[0].texto} = ${f.nombre}(${args(v.slice(1))});`] });
    else out.push({ cat: 'Llamar', etiqueta: `${f.nombre}(${ps.map(() => '_').join(', ')});`, huecos, armar: v => [`${f.nombre}(${args(v)});`] });
  }
  out.push({
    cat: 'Memoria', etiqueta: 'free(_);', clase: 'mem',
    huecos: [{ k: 'expr', tipo: () => null, soloStructs: true, sinNull: true }],
    armar: v => [`free(${v[0].texto});`],
  });
  out.push({ cat: 'Control', etiqueta: 'if (_ == NULL) { … }', huecos: [{ k: 'expr', tipo: () => null, sinNull: true, soloStructs: true }],
    armar: v => [`if (${v[0].texto} == NULL) {`, '', '}'], dentro: 1 });
  out.push({ cat: 'Control', etiqueta: 'if (_ != NULL) { … }', huecos: [{ k: 'expr', tipo: () => null, sinNull: true, soloStructs: true }],
    armar: v => [`if (${v[0].texto} != NULL) {`, '', '}'], dentro: 1 });
  out.push({ cat: 'Control', etiqueta: '} else { … }', huecos: [], armar: () => ['else {', '', '}'], dentro: 1, sinoDe: true });
  out.push({ cat: 'Control', etiqueta: 'while (_ != NULL) { … }', huecos: [{ k: 'expr', tipo: () => null, sinNull: true, soloStructs: true }],
    armar: v => [`while (${v[0].texto} != NULL) {`, '', '}'], dentro: 1 });
  if (retorno && !(retorno.base === 'void' && !retorno.ptr)) {
    out.push({ cat: 'Control', etiqueta: 'if (_ == NULL) return _;', huecos: [{ k: 'expr', tipo: () => null, sinNull: true, soloStructs: true }, { k: 'ret' }],
      armar: v => [`if (${v[0].texto} == NULL) return ${v[1].texto};`] });
    out.push({ cat: 'Retorno', etiqueta: 'return _;', huecos: [{ k: 'ret' }], armar: v => [`return ${v[0].texto};`] });
  } else {
    out.push({ cat: 'Control', etiqueta: 'if (_ == NULL) return;', huecos: [{ k: 'expr', tipo: () => null, sinNull: true, soloStructs: true }],
      armar: v => [`if (${v[0].texto} == NULL) return;`] });
    out.push({ cat: 'Retorno', etiqueta: 'return;', huecos: [], armar: () => ['return;'] });
  }
  return out;
}

// Partes que se pueden cambiar en una línea: expresiones (map->buckets[pos]->key, aux, NULL, 0…), no las
// palabras de C, los tipos, los nombres de funciones ni el nombre que se declara. → [{ini, fin, texto}]
const PALABRAS = new Set(['if', 'else', 'while', 'for', 'return', 'sizeof', 'do', 'break', 'continue', 'long', 'int', 'char', 'void', 'double', 'float', 'short', 'unsigned', 'signed', 'const', 'struct']);
function partesDe(t, est = {}) {
  const m = enmascarar(t), out = [];
  for (const r of m.matchAll(/-?\b\d+\b|\b[A-Za-z_]\w*(?:\s*->\s*[A-Za-z_]\w*|\[[^\[\]]*\])*/g)) {
    const texto = t.slice(r.index, r.index + r[0].length).trim(), primera = /^[A-Za-z_]\w*/.exec(texto)?.[0];
    if (primera && (PALABRAS.has(primera) || est[primera])) continue;   // palabra de C o tipo
    if (/^\s*\(/.test(m.slice(r.index + r[0].length))) continue;   // nombre de una función
    if (/\b(long|int|char|void|double|float|short|unsigned|[A-Z]\w*)\s*\**\s*$/.test(m.slice(0, r.index)) && !/[=(,]\s*$/.test(m.slice(0, r.index))) continue;   // el nombre que se declara
    out.push({ ini: r.index, fin: r.index + r[0].length, texto });
  }
  return out;
}

// La condición de un if/while de la línea, partida en sus partes unidas por && o || (solo las de afuera,
// no las que están entre paréntesis). → {ini, fin, partes: [texto], ops: ['&&', …]} o null
function condicionDe(linea) {
  const m = enmascarar(linea), r = /\b(if|while)\s*\(/.exec(m);
  if (!r) return null;
  const ini = r.index + r[0].length;
  let p = 1, k = ini;
  for (; k < m.length && p; k++) { if (m[k] === '(') p++; else if (m[k] === ')') p--; }
  if (p) return null;
  const fin = k - 1;   // la posición del «)» que cierra
  const partes = [], ops = [], rangos = [];
  let a = ini; p = 0;
  for (let j = ini; j < fin; j++) {
    if (m[j] === '(') p++; else if (m[j] === ')') p--;
    else if (!p && (m.startsWith('&&', j) || m.startsWith('||', j))) { partes.push(linea.slice(a, j).trim()); rangos.push([a, j]); ops.push(m.slice(j, j + 2)); a = j + 2; j++; }
  }
  partes.push(linea.slice(a, fin).trim()); rangos.push([a, fin]);
  return { ini, fin, partes, ops, rangos };
}

// Piezas por niveles: una expresión se parte en tramos (map | ->buckets | [i] | ->key). Se muestran las del
// nivel del prefijo elegido; si hay más hondas, un botón «map->…» para entrar. Pocas piezas: todas de una vez.
const tramos = t => { const m = String(t).match(/^[A-Za-z_]\w*|->[A-Za-z_]\w*|\[[^\[\]]*\]/g); return m && m.join('') === t ? m : null; };
// Índices de las piezas parecidas a `actual` (una expresión compuesta): las hermanas (mismo prefijo), la de
// arriba, sus hijas y las que solo cambian un índice [..]. Las más parecidas primero.
function parecidasA(actual, piezas) {
  const ta = tramos(actual);
  if (!ta || ta.length < 2) return [];
  const padre = ta.slice(0, -1).join(''), sinIndices = t => t.map(x => x.startsWith('[') ? '[]' : x).join('');
  const puntaje = (p, i) => {
    const t = tramos(p.texto);
    if (!t || p.texto === actual) return 0;
    if (t.length === ta.length && t.slice(0, -1).join('') === padre) return 4;   // hermana: ->key → ->value
    if (t.length === ta.length && sinIndices(t) === sinIndices(ta)) return 3;   // otro índice: [i] → [pos]
    if (p.texto === padre) return 2;   // la de arriba: map->buckets[i]
    if (t.length === ta.length + 1 && t.slice(0, -1).join('') === actual) return 1;   // una hija
    return 0;
  };
  return piezas.map((p, i) => [puntaje(p, i), i]).filter(([n]) => n).sort((a, b) => b[0] - a[0]).slice(0, 8).map(([, i]) => i);
}
function htmlPiezas(piezas, prefijo = [], yaVistas = new Set()) {
  const chip = (p, i) => yaVistas.has(i) ? '' : `<button class="chip pieza" data-i="${i}" title="${p.base ? esc(nombreTipo(p)) : ''}">${esc(p.texto)}</button>`;
  if (piezas.length <= 7) return piezas.map(chip).join('');
  const pre = prefijo.join(''), grupos = new Map(), sueltas = [];
  piezas.forEach((p, i) => {
    const ts = tramos(p.texto);
    if (!ts) { if (!prefijo.length) sueltas.push(chip(p, i)); return; }   // NULL, 0, pos + 1, malloc…
    if (ts.length <= prefijo.length || ts.slice(0, prefijo.length).join('') !== pre) return;
    const sig = ts[prefijo.length];
    if (!grupos.has(sig)) grupos.set(sig, { hoja: null, mas: null });
    const g = grupos.get(sig);
    if (ts.length === prefijo.length + 1) g.hoja = i;
    else g.mas ??= ts[prefijo.length + 1].startsWith('[') ? '[…]' : '->…';
  });
  let h = prefijo.length ? '<button class="chip nav" data-nav="..">‹</button>' : '';
  for (const [sig, g] of grupos) {
    if (g.hoja != null) h += chip(piezas[g.hoja], g.hoja);
    if (g.mas) h += `<button class="chip nav" data-nav="${esc(sig)}">${esc(pre + sig + g.mas)}</button>`;
  }
  return h + sueltas.join('');
}

// El grupo de un comando, para mostrar menos opciones: if / while / for / else en Control; el tipo en Variables;
// la función en Memoria y Llamar; los demás, solos.
function grupoDe(p) {
  const e = p.etiqueta;
  if (p.cat === 'Control') return /^\}?\s*else/.test(e) ? 'else' : (/^(if|while|for)\b/.exec(e)?.[1] ?? e);
  if (p.cat === 'Variables') return /^(.*?)\s*(?<![A-Za-z0-9])_(?![A-Za-z0-9])/.exec(e)?.[1] || e;
  if (p.cat === 'Memoria' || p.cat === 'Llamar') return /\b(malloc|calloc|free|[A-Za-z_]\w*)\s*\(/.exec(e.replace(/sizeof\s*\(/g, ''))?.[1] ?? e;
  return e;
}

// Nombres lógicos para una variable según de dónde sale (el final de la expresión; el más largo que calce).
// Un ejercicio puede agregar los suyos en ejercicio.json → nombresLogicos.
const NOMBRES_LOGICOS = {
  'root': 'aux', 'current': 'actual', 'current->prev': 'anterior', 'current->next': 'siguiente',
  'head': 'primero', 'tail': 'ultimo', 'prev': 'anterior', 'next': 'siguiente',
  'left': 'izq', 'right': 'der', 'parent': 'padre', 'pair': 'par', 'buckets[]': 'par',
  'key': 'clave', 'value': 'valor', 'data': 'dato',
};
function nombreLogico(texto, extra = {}) {
  const dic = { ...NOMBRES_LOGICOS, ...extra };
  const ts = (texto.match(/->\s*[A-Za-z_]\w*|\[[^\[\]]*\]/g) ?? []).map(t => t.startsWith('[') ? '[]' : t.replace(/^->\s*/, ''));
  for (let k = Math.min(ts.length, 3); k >= 1; k--) {
    const fin = ts.slice(-k).join('->').replace(/->\[\]/g, '[]');
    if (dic[fin]) return dic[fin];
  }
  return null;
}
export const NOMBRES_SUGERIDOS = ['aux', 'actual', 'anterior', 'siguiente', 'nuevo', 'izq', 'der', 'padre', 'par', 'pos', 'i'];

// Las expresiones de una parte del dibujo vienen en grupos separados por «¦»: primero las formas de nombrar
// eso mismo (alias: aux, list->current…); después, las de respaldo. Se usa el primer grupo que tenga alguna
// que sirva (con `sirve(texto)` → la pieza o expresión, o undefined).
function primerGrupo(cands, sirve) {
  const grupos = [[]];
  for (const c of cands) if (c === '¦') grupos.push([]); else grupos.at(-1).push(c);
  for (const g of grupos) {
    const ok = [...new Map(g.map(sirve).filter(Boolean).map(x => [x.texto, x])).values()];
    if (ok.length) return ok;
  }
  return [];
}

// ¿La línea es una de las plantillas? → {plantilla, textos de sus huecos}. Se compara con la
// primera línea que arma la plantilla, sin importar los espacios.
function reconocer(linea, todas) {
  const t = linea.trim();
  for (const p of todas) {
    if (p.sinoDe || !p.huecos.length) continue;
    const modelo = p.armar(p.huecos.map(() => ({ texto: '\u0001' })))[0];
    const re = new RegExp('^' + modelo.split('\u0001').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')).join('\\s*([\\w.\\[\\]*&>-]+)\\s*') + '$');
    const m = re.exec(t.replace(/\s+/g, ' '));
    if (m) return { plantilla: p, textos: m.slice(1) };
  }
  return null;
}

export class Asistente {
  // caja: elemento del panel; editor: Editor; obtener(): {ej, archivos}; alAgregar(): avisa que cambió list.c
  // alCambiarFuncion(nombre): el cursor entró a otra función (para elegir su paso)
  // alPiezas(textos): las piezas que se pueden elegir ahora (para marcarlas en el dibujo); [] si no hay hueco
  constructor(caja, editor, obtener, { alCambiarFuncion, alPiezas } = {}) {
    this.alCambiarFuncion = alCambiarFuncion;
    this.alPiezas = alPiezas;
    this.caja = caja;
    this.editor = editor;
    this.obtener = obtener;
    this.cat = 'Variables';
    this.armando = null;   // {plantilla, valores}
    let t = null;
    editor.cm.on('cursorActivity', () => {
      // si el cursor sale de la selección, la selección vuelve a ser la unidad del cursor
      if (this.sel) { const n = editor.cm.getCursor().line; if (n < this.sel.ini || n > this.sel.fin) this.sel = null; }
      // si se estaba editando una línea y el cursor se fue a otra, se cancela
      if (this.armando?.editando != null && editor.cm.getCursor().line !== this.armando.linea) this.armando = null;
      if (this.sinAuto != null && editor.cm.getCursor().line !== this.sinAuto) this.sinAuto = null;
      if (this.borrador && editor.cm.getCursor().line !== this.borrador.linea) this.borrador = null;   // confirmado
      clearTimeout(t); t = setTimeout(() => this.dibujar(), 120); });
  }

  contexto() {
    const { ej } = this.obtener();
    const cm = this.editor.cm;
    if (this.editor.actual !== ej.alumno) return { ej, fuera: `Abre ${ej.alumno} para usar los comandos.` };
    const texto = cm.getValue(), c = cm.getCursor(), pos = cm.indexFromPos(c);
    const fn = funcionEn(texto, cm.indexFromPos({ line: c.line, ch: 0 }));   // la línea de la } final también cuenta
    if (!fn) return { ej, texto, fuera: 'Pon el cursor dentro de una función, o elige un paso y toca ✎ Escribir.' };
    const est = ej.estructuras ?? {};
    const vars = variablesEn(texto, fn, pos);
    const finLinea = cm.posFromIndex(fn.fin).line, iniLinea = cm.posFromIndex(fn.cuerpo).line;
    const linea = cm.getLine(c.line);
    const editable = c.line > iniLinea && c.line < finLinea && (/[^\s{}]/.test(linea) || !linea.trim());   // ni la cabecera, ni la } final, ni solo llaves (una vacía sí: para borrarla)
    // las variables para editar la línea son las visibles al comienzo de ella
    const varsLinea = variablesEn(texto, fn, cm.indexFromPos({ line: c.line, ch: 0 }));
    return { ej, texto, fn, vars, est, exprs: expresiones(vars, est), linea: editable ? { n: c.line, texto: linea, exprs: expresiones(varsLinea, est) } : null };
  }

  // Piezas para el hueco actual.
  piezas(ctx, hueco, valores) {
    const { exprs, vars, fn } = ctx;
    if (hueco.k === 'nombre') {
      const usados = new Set(vars.map(v => v.nombre));
      return hueco.sug.filter(n => !usados.has(n)).map(n => ({ texto: n }));
    }
    if (hueco.libre) {   // editar una parte de una línea cualquiera: primero las del mismo tipo, después las demás
      const t = hueco.preferido;
      const otras = [...exprs.filter(e => t && mismo(e, t)), ...exprs.filter(e => !(t && mismo(e, t)))];
      return [...otras, ...['0', '1', '-1'].map(x => ({ texto: x, ...T('long', 0) })), { texto: 'NULL', base: 'void', ptr: 1 }];
    }
    if (hueco.k === 'lval') return exprs.filter(e => hueco.num ? esNum(e) : hueco.tipo ? mismo(e, hueco.tipo(valores)) : true).map(e => ({ ...e }));
    const deseado = hueco.k === 'ret' ? fn.retorno : hueco.tipo(valores);
    let lista = exprs.filter(e => deseado ? mismo(e, deseado) : (!hueco.soloStructs || ctx.est[e.base]));
    if (esNum(deseado)) lista = [...lista, ...['0', '1', '-1'].map(t => ({ texto: t, ...T('long', 0) }))];
    // a la derecha de «x = _» (x entero): también cálculos con x (x + 1, x - 1, x * 2, (x + 1) % capacidad)
    if (hueco.calculos && esNum(deseado) && valores[0]) {
      const x = valores[0].texto, caps = exprs.filter(e => esNum(e) && /capacity|capacidad/i.test(e.texto) && e.texto !== x);
      lista = [...[`${x} + 1`, `${x} - 1`, `${x} * 2`, ...caps.map(c => `(${x} + 1) % ${c.texto}`)].map(t => ({ texto: t, ...T('long', 0) })), ...lista];
    }
    // valor inicial de un for: también «algo + 1» (por ejemplo, map->current + 1)
    if (hueco.masUno) lista = [...lista, ...exprs.filter(e => esNum(e)).map(e => ({ ...e, texto: `${e.texto} + 1` }))];
    if (!hueco.sinNull && (!deseado || deseado.ptr)) lista = [...lista, { texto: 'NULL', base: deseado?.base ?? 'void', ptr: deseado?.ptr ?? 1 }];
    // un struct nuevo en memoria: (List *)malloc(sizeof(List))
    if (deseado?.ptr === 1 && ctx.est[deseado.base]) lista = [...lista, { texto: `(${deseado.base} *)malloc(sizeof(${deseado.base}))`, base: deseado.base, ptr: 1 }];
    return lista;
  }

  dibujar() {
    const ctx = this.contexto();
    const { ej, archivos } = this.obtener();
    // Selector de la función que se implementa
    // Las funciones que ya están en el archivo, en orden: se pasa de una a otra con un toque
    const nombreFn = ctx.fn?.nombre ?? null;
    if (nombreFn !== this.fnAnterior) { this.fnAnterior = nombreFn; if (nombreFn) this.alCambiarFuncion?.(nombreFn); }
    let html = '<div class="fila">';
    if (ctx.fn) html += `<b class="fn-actual">${esc(ctx.fn.nombre)}</b><span class="vars">${ctx.vars.map(v => `<code title="${esc(nombreTipo(v))}">${esc(v.nombre)}</code>`).join(' ')}</span>`;
    html += '</div>';

    if (this.borrador && !ctx.fuera) html += '<p class="nota borrador">✏️ Borrador: toca otra parte del dibujo para cambiar esta línea; ↵ la confirma.</p>';
    if (ctx.fuera) {
      html += `<p class="nota">${esc(ctx.fuera)}</p>`;
    } else {
      const { ocultos = {} } = this.obtener();
      if (!this.nombres || this.nombresDe !== ej.id) {   // del código base: los .h y el código del curso
        const textos = [...ej.archivos.filter(a => a.nombre.endsWith('.h')).map(a => archivos[a.nombre]), ocultos[ej.referencia]];
        const campos = new Set(Object.values(ctx.est).flatMap(c => Object.keys(c)));
        this.nombres = nombresDelCodigo(textos, [...Object.keys(ctx.est), 'void'], campos);
        this.nombresDe = ej.id;
      }
      const todas = plantillas(ctx.est, ej.constructores ?? [], ctx.fn.retorno, this.nombres, (ej.llamadas ?? []).filter(f => f.nombre !== ctx.fn.nombre), ej.comandos ?? []);
      // al tocar una línea queda en modo edición (sus partes se tocan para cambiarlas); en una línea vacía,
      // los comandos para escribir una nueva. Mientras se arma un comando nuevo, no hay barra de la línea.
      const construyendo = this.armando && this.armando.editando == null;
      const sel = ctx.linea && !construyendo ? this.seleccion() : null;
      this.editor.marcarSeleccion(sel ? sel.ini : null, sel?.fin);
      if (ctx.linea && sel) {
        this.lineaActual = { ...ctx.linea, rec: reconocer(ctx.linea.texto, todas) };
        if (!this.armando && ctx.linea.texto.trim() && sel.ini === ctx.linea.n && this.sinAuto !== ctx.linea.n
          && (this.lineaActual.rec || partesDe(ctx.linea.texto, ctx.est).length)) this.editarLinea(true);
        const n = sel.fin - sel.ini + 1;
        const que = n === 1 ? `Línea ${sel.ini + 1}` : `Líneas ${sel.ini + 1}–${sel.fin + 1}`;
        html += `<div class="fila linea-actual"><span class="nota">${que}:</span>`
          + (this.armando?.editando != null && n === 1 ? '' : n === 1 ? (ctx.linea.texto.trim() ? `<code>${esc(ctx.linea.texto.trim())}</code>` : '<span class="nota">(vacía)</span>') : `<code>${esc(this.editor.cm.getLine(sel.ini).trim())} …</code>`)
          + '<span class="grupo">'
          // si se eligió una parte de una condición (if/while con && o ||): ◀ ▶ mueven esa componente y ✕ la quita
          + (() => {
            const a = this.armando, k = this.componenteElegida();
            if (k == null) return '';
            const n = condicionDe(this.editor.cm.getLine(a.linea)).partes.length;
            return `<button data-tmov="${k}" data-dir="-1" title="Mover esta parte de la condición a la izquierda (se revisa antes)"${k ? '' : ' disabled'}>◀</button>`
              + `<button data-tmov="${k}" data-dir="1" title="Mover esta parte de la condición a la derecha"${k < n - 1 ? '' : ' disabled'}>▶</button>`
              + `<button data-tdel="${k}" title="Quitar esta parte de la condición">✕</button>`;
          })()
          + '<button class="mover" data-dir="-1" title="Mover arriba (si choca con un bloque, entra en él; al borde de su bloque, sale)">↑</button>'
          + '<button class="mover" data-dir="1" title="Mover abajo">↓</button>'
          + '<button class="ampliar" data-mas="1" title="Agregar a la selección la instrucción (o bloque) siguiente">＋</button>'
          + (this.finUnidad(sel.m, sel.ini) < sel.fin ? '<button class="ampliar" data-mas="0" title="Quitar la última de la selección">−</button>' : '')
          + `<button class="borrar-sel" title="Borrar lo seleccionado">🗑</button>`
          + '<button class="deshacer" title="Deshacer (Ctrl+Z)">↶</button></span></div>';
        // en un if/while: agregar a la condición con && o ||
        if (/^(\}\s*else\s+)?(if|while)\s*\(/.test(ctx.linea.texto.trim()) && n === 1 || /^(\}\s*else\s+)?(if|while)\s*\(/.test(this.editor.cm.getLine(sel.ini).trim()) && sel.ini === ctx.linea.n) {
          // se agrega a la derecha («… && _ != NULL»); para que se revise antes, se elige y se mueve con ◀
          this.condiciones = ['der'].flatMap(lado => [['&&', '!='], ['&&', '=='], ['||', '!='], ['||', '==']].map(([o, c]) => [o, c, lado]));
          html += `<div class="fila condicion"><span class="nota">Agregar a la condición:</span>${this.condiciones.map(([o, c, lado], i) =>
            `<button class="chip" data-cond="${i}">${lado === 'der' ? `… ${o} _ ${c} NULL` : `_ ${c} NULL ${o} …`}</button>`).join('')}</div>`;
        }
      } else this.lineaActual = null;
      if (this.armando) {
      const { plantilla, valores } = this.armando;
      const hueco = plantilla.huecos[valores.length];
      const editando = this.armando.editando;
      const actualI = editando ?? valores.length;   // -1: editando una línea, aún sin elegir qué parte
      const vista = plantilla.etiqueta.split(/(?<![A-Za-z0-9])_(?![A-Za-z0-9])/).map((s, i, a) => esc(s) + (i < a.length - 1
        ? (i < valores.length && i !== editando ? `<b class="lleno" data-h="${i}" title="Toca para cambiar">${esc(valores[i].texto)}</b>`
          : `<span class="hueco${i === actualI ? ' actual' : ''}">${i === editando ? esc(valores[i].texto) : '_'}</span>`) : '')).join('');
      html += `<div class="fila armando">${editando != null ? '<span class="nota">✎</span>' : ''}<code class="vista">${vista}</code><button class="cancelar" title="${editando != null ? 'Dejar de editar (para escribir una línea nueva aquí)' : 'Cancelar'}">✕</button></div>`;
      if (editando === -1) {
        html += '<p class="nota">Toca la parte de la línea que quieres cambiar. Para escribir una línea nueva: ↵ (o ✕).</p>';
        this.piezasActuales = [];
      } else {
      if (editando != null) html += '<p class="nota">Elige la pieza nueva (o toca otra parte de la línea para cambiar esa).</p>';
      const piezas = this.piezas(this.armando.ctxLinea ?? ctx, plantilla.huecos[actualI], valores);
      // por niveles, para no saturar: map y map->… ; al tocar map->…: map->buckets, map->buckets[…], map->size…
      const clave = `${this.armando.linea}|${actualI}|${valores.length}|${plantilla.etiqueta}`;
      if (this.navClave !== clave) { this.navClave = clave; this.navPrefijo = []; }
      // al cambiar una parte compuesta (map->buckets[i]->key), primero las parecidas: mismo prefijo, la de arriba
      // (map->buckets[i]) y las que cambian solo el índice (map->buckets[pos]->key)
      const actual = editando != null && editando >= 0 ? valores[editando]?.texto : null;
      const parecidas = actual ? parecidasA(actual, piezas) : [];
      if (parecidas.length) html += `<div class="chips parecidas"><span class="nota">Parecidas:</span>${parecidas.map(i => `<button class="chip pieza" data-i="${i}">${esc(piezas[i].texto)}</button>`).join('')}</div>`;
      html += `<div class="chips">${htmlPiezas(piezas, this.navPrefijo, new Set(parecidas))}`
        + (piezas.length ? '' : `<span class="nota">No hay ${plantilla.huecos[actualI].k === 'nombre' ? 'nombres libres' : 'piezas de ese tipo'} aquí.</span>`) + '</div>';
      this.piezasActuales = piezas;
      }
      } else {
      const cats = [...new Set(todas.map(p => p.cat))];
      if (!cats.includes(this.cat)) this.cat = cats[0];
      html += `<div class="fila cats">${cats.map(c => `<button class="cat${c === this.cat ? ' activa' : ''}" data-cat="${c}">${c}</button>`).join('')}</div>`;
      this.plantillasActuales = todas.filter(p => p.cat === this.cat);
      // menos opciones a la vista: los comandos se agrupan (if …, while …, for …; TreeNode * …; malloc …) y al tocar
      // un grupo se abren sus alternativas; un grupo de uno se muestra directo
      const grupos = new Map();
      this.plantillasActuales.forEach((p, i) => { const g = grupoDe(p); if (!grupos.has(g)) grupos.set(g, []); grupos.get(g).push(i); });
      if (!grupos.has(this.grupoAbierto)) this.grupoAbierto = null;
      const chipP = i => `<button class="chip ${this.plantillasActuales[i].clase ?? ''}" data-p="${i}">${esc(this.plantillasActuales[i].etiqueta)}</button>`;
      html += '<div class="chips">' + (this.grupoAbierto != null
        ? '<button class="chip nav" data-grupo="">‹</button>' + grupos.get(this.grupoAbierto).map(chipP).join('')
        : [...grupos].map(([g, is]) => is.length === 1 ? chipP(is[0]) : `<button class="chip nav grupo" data-grupo="${esc(g)}">${esc(g)} …</button>`).join('')) + '</div>';
      if (ctx.linea && !ctx.linea.texto.trim()) html += '<p class="nota">O toca el dibujo: lo primero crea una variable con eso; lo segundo, la asignación «primero = segundo».</p>';
      }
    }
    this.caja.innerHTML = html;
    if (!this.armando) this.piezasActuales = null;
    this.alPiezas?.(this.piezasActuales?.map(p => p.texto) ?? []);   // se marca solo lo que sirve para un hueco que espera

    this.caja.querySelectorAll('.cat').forEach(b => b.onclick = () => { this.cat = b.dataset.cat; this.grupoAbierto = null; this.dibujar(); });
    this.caja.querySelectorAll('[data-grupo]').forEach(b => b.onclick = () => { this.grupoAbierto = b.dataset.grupo || null; this.dibujar(); });
    this.caja.querySelectorAll('[data-p]').forEach(b => b.onclick = () => this.empezar(this.plantillasActuales[+b.dataset.p]));
    this.caja.querySelectorAll('.pieza').forEach(b => b.onclick = () => this.elegir(this.piezasActuales[+b.dataset.i]));
    this.caja.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => {
      if (b.dataset.nav === '..') this.navPrefijo = this.navPrefijo.slice(0, -1); else this.navPrefijo = [...this.navPrefijo, b.dataset.nav];
      this.dibujar();
    });
    this.caja.querySelectorAll('.lleno').forEach(b => b.onclick = () => { this.armando.editando = +b.dataset.h; this.dibujar(); });
    const q = s => this.caja.querySelector(s);
    if (q('.editar-linea')) q('.editar-linea').onclick = () => this.editarLinea();
    if (q('.borrar-linea')) q('.borrar-linea').onclick = () => this.borrarLinea();
    if (q('.borrar-sel')) q('.borrar-sel').onclick = () => this.borrarSeleccion();
    this.caja.querySelectorAll('.mover').forEach(b => b.onclick = () => this.mover(+b.dataset.dir));
    this.caja.querySelectorAll('.ampliar').forEach(b => b.onclick = () => this.ampliar(b.dataset.mas === '1'));
    this.caja.querySelectorAll('[data-cond]').forEach(b => b.onclick = () => {
      const [op, cmp, lado] = this.condiciones[+b.dataset.cond];
      this.empezar({ etiqueta: lado === 'der' ? `… ${op} _ ${cmp} NULL` : `_ ${cmp} NULL ${op} …`, huecos: [{ k: 'expr', tipo: () => null, sinNull: true, soloStructs: true }],
        condicion: { op, cmp, lado, linea: this.editor.cm.getCursor().line }, armar: v => [] });
    });
    this.caja.querySelectorAll('[data-tmov]').forEach(b => b.onclick = () => this.cambiarCondicion(+b.dataset.tmov, +b.dataset.dir));
    this.caja.querySelectorAll('[data-tdel]').forEach(b => b.onclick = () => this.cambiarCondicion(+b.dataset.tdel, 0));
    if (q('.deshacer')) q('.deshacer').onclick = () => { this.editor.cm.undo(); this.editor.cm.focus(); };
    const c = this.caja.querySelector('.cancelar'); if (c) c.onclick = () => { if (this.armando?.editando != null) this.sinAuto = this.armando.linea; this.armando = null; this.dibujar(); };
    // los botones no le quitan el foco al editor
    this.caja.querySelectorAll('button').forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));
  }

  empezar(plantilla) {
    this.armando = { plantilla, valores: [] };
    if (!plantilla.huecos.length) return this.terminar();
    this.dibujar();
  }

  elegir(pieza) {
    if (this.armando.editando != null) {   // editar una línea existente: se cambia esa parte y listo
      const { plantilla, valores, linea, editando } = this.armando;
      valores[editando] = pieza;
      this.armando = null;
      const cm = this.editor.cm, ln = cm.getLine(linea);
      cm.replaceRange((ln.match(/^\s*/) || [''])[0] + plantilla.armar(valores)[0], { line: linea, ch: 0 }, { line: linea, ch: ln.length });
      cm.setCursor({ line: linea, ch: cm.getLine(linea).length });
      cm.focus();
      return this.dibujar();
    }
    this.armando.valores.push(pieza);
    if (this.armando.valores.length === this.armando.plantilla.huecos.length) this.terminar();
    else this.dibujar();
  }

  terminar() {
    const { plantilla, valores } = this.armando;
    this.armando = null;
    if (plantilla.condicion) {   // «if (a)» → «if (a && b != NULL)»
      const { op, cmp, lado, linea } = plantilla.condicion, cm = this.editor.cm, L = cm.getLine(linea), m = enmascarar(L);
      const r = /\b(if|while)\s*\(/.exec(m);
      if (r) {
        const ini = r.index + r[0].length;   // justo después del «(»
        let p = 0, k = ini - 1;
        for (; k < m.length; k++) { if (m[k] === '(') p++; else if (m[k] === ')' && !--p) break; }
        if (k < m.length) {
          if (lado === 'izq') cm.replaceRange(`${valores[0].texto} ${cmp} NULL ${op} `, { line: linea, ch: ini });
          else cm.replaceRange(` ${op} ${valores[0].texto} ${cmp} NULL`, { line: linea, ch: k });
        }
      }
      cm.setCursor({ line: linea, ch: cm.getLine(linea).length });
      return this.dibujar();
    }
    this.insertar(plantilla.armar(valores), plantilla.dentro, plantilla.sinoDe);
    this.dibujar();
  }

  // Se tocó una parte del dibujo: cands son las expresiones que la nombran (de la más precisa a la menos).
  // Si hay un hueco esperando y alguna sirve, se elige. → 'ok' | 'sin-hueco' | 'no-sirve'
  // Se tocó una parte del dibujo: cands son las expresiones que la nombran (de la más precisa a la menos).
  // → 'ok' | 'sin-hueco' | 'no-sirve' | {elegir: [textos]} (varias formas sirven: hay que escoger una;
  // después se llama de nuevo con [la escogida] y elegida = true)
  tocar(cands, elegida = false) {
    const cm = this.editor.cm;
    if (this.borrador && cm.getCursor().line === this.borrador.linea) return this.cambiarBorrador(cands, elegida);
    if (!this.armando) {   // en una línea vacía: se declara una variable con lo tocado
      const ctx = this.contexto();
      if (ctx.linea && !ctx.linea.texto.trim()) return this.tocarSinHueco(cands, elegida);
    }
    if (!this.armando || !this.piezasActuales?.length) return 'sin-hueco';
    const iguales = primerGrupo(cands, c => this.piezasActuales.find(x => x.texto === c));   // los alias que sirven
    if (!iguales.length) return 'no-sirve';
    if (iguales.length > 1 && !elegida) return { elegir: iguales.slice(0, 3).map(p => p.texto) };
    this.elegir(iguales[0]);
    return 'ok';
  }

  // La línea que se armó tocando el dibujo queda como borrador hasta ↵ (o hasta ir a otra línea):
  //   1er toque: «Tipo aux = a;»   2º toque (b, del mismo tipo): «a = b;»   otro toque (c): «a = c;»
  //   un toque de otro tipo: se declara una variable nueva con eso.
  cambiarBorrador(cands, elegida = false) {
    const b = this.borrador, ctx = this.contexto(), cm = this.editor.cm;
    const varsAntes = ctx.vars.filter(v => !(b.tipo === 'var' && new RegExp(`\\b${v.nombre}\\s*=`).test(cm.getLine(b.linea))));
    const exprs = expresiones(varsAntes, ctx.est);
    const objetivo0 = b.tipo === 'var' ? b.primero : b.izq;
    const calza0 = x => mismo(x, objetivo0) || (x.ptr && objetivo0.ptr && x.base === objetivo0.base);
    // de preferencia el grupo que calza con lo primero (para asignar); si no, el primero que tenga algo
    const posibles = primerGrupo(cands, c => { const x = exprs.find(y => y.texto === c); return x && calza0(x) && x.texto !== objetivo0.texto ? x : undefined; }).length
      ? primerGrupo(cands, c => { const x = exprs.find(y => y.texto === c); return x && calza0(x) && x.texto !== objetivo0.texto ? x : undefined; })
      : primerGrupo(cands, c => exprs.find(y => y.texto === c));
    if (!posibles.length) return 'no-sirve';
    const objetivo = b.tipo === 'var' ? b.primero : b.izq;   // con qué tiene que calzar para asignar
    const calza = x => mismo(x, objetivo) || (x.ptr && objetivo.ptr && x.base === objetivo.base);
    const opciones = posibles;
    if (opciones.length > 1 && !elegida) return { elegir: opciones.slice(0, 3).map(e => e.texto) };   // varios alias: se escoge
    const e = opciones[0];
    const sangria = (cm.getLine(b.linea).match(/^\s*/) || [''])[0];
    const poner = texto => { cm.replaceRange(sangria + texto, { line: b.linea, ch: 0 }, { line: b.linea, ch: cm.getLine(b.linea).length }); cm.setCursor({ line: b.linea, ch: cm.getLine(b.linea).length }); };
    this.armando = null;
    if (calza(e) && e.texto !== objetivo.texto) {   // asignación: lo primero = lo nuevo
      this.borrador = { tipo: 'asig', linea: b.linea, izq: objetivo, der: e };
      poner(`${objetivo.texto} = ${e.texto};`);
    } else {   // otro tipo: una variable nueva con eso
      this.borrador = { tipo: 'var', linea: b.linea, primero: e };
      poner(this.declaracion(e, varsAntes));
    }
    this.dibujar();
    return 'ok';
  }

  // La declaración de una variable con la expresión e: «TreeNode * left = aux->left;» (con un nombre libre).
  declaracion(e, vars) {
    const usados = new Set(vars.map(v => v.nombre));
    // un puntero a una estructura (un nodo, un par…): «aux» (es el que después se va moviendo); un texto, un dato
    // o un entero, según el campo (key → clave, value → valor, data → dato, el nombre del campo)
    const ultimo = /([A-Za-z_]\w*)$/.exec(e.texto)?.[1];
    const base = nombreLogico(e.texto, this.obtener().ej.nombresLogicos) ?? (e.ptr && !['void', 'char'].includes(e.base) ? 'aux'
      : ultimo && !/\]$/.test(e.texto) && /->/.test(e.texto) ? ultimo : { void: 'dato', char: 'clave', long: 'n', int: 'n' }[e.base] ?? 'aux');
    let nombre = base, k = 2;
    while (usados.has(nombre)) nombre = `${base}${k++}`;
    const decl = e.ptr ? `${e.base} ${'*'.repeat(e.ptr)} ${nombre}` : `${e.base === 'int' || e.base === 'long' ? 'long' : e.base} ${nombre}`;
    return `${decl} = ${e.texto};`;
  }

  // Cambia el nombre de una variable (o parámetro) en toda la función donde está el cursor. → true si se pudo
  renombrar(viejo, nuevo) {
    const cm = this.editor.cm, texto = cm.getValue();
    const fn = funcionEn(texto, cm.indexFromPos({ line: cm.getCursor().line, ch: 0 }));
    if (!fn || !/^[A-Za-z_]\w*$/.test(nuevo) || PALABRAS.has(nuevo) || viejo === nuevo) return false;
    const ini = texto.lastIndexOf('\n', texto.lastIndexOf('(', fn.cuerpo)) + 1;   // desde la cabecera (los parámetros)
    const m = enmascarar(texto);
    const ya = new RegExp(`\\b${nuevo}\\b`).test(m.slice(ini, fn.fin));
    if (ya) return false;   // ese nombre ya se usa en la función
    let nuevoTexto = '', a = ini;
    for (const r of m.slice(ini, fn.fin).matchAll(new RegExp(`(?<![\\w.>])${viejo}\\b`, 'g'))) {   // no los campos (x->viejo)
      const k = ini + r.index;
      nuevoTexto += texto.slice(a, k) + nuevo; a = k + viejo.length;
    }
    nuevoTexto += texto.slice(a, fn.fin);
    const c = cm.getCursor();
    cm.replaceRange(nuevoTexto, cm.posFromIndex(ini), cm.posFromIndex(fn.fin));
    cm.setCursor(c);
    this.armando = null;
    this.dibujar();
    return true;
  }

  // Tocar el dibujo en una línea vacía: se declara una variable con eso («TreeNode * left = aux->left;»), como
  // borrador (el siguiente toque la puede volver una asignación).
  tocarSinHueco(cands, elegida = false) {
    const ctx = this.contexto();
    if (ctx.fuera || !ctx.fn) return 'sin-hueco';
    const alias = primerGrupo(cands, c => ctx.exprs.find(x => x.texto === c));   // varias formas de lo mismo: se escoge cuál usar
    if (!alias.length) return 'no-sirve';
    if (alias.length > 1 && !elegida) return { elegir: alias.slice(0, 3).map(e => e.texto) };
    const e = alias[0];
    this.insertar([this.declaracion(e, ctx.vars)]);
    this.borrador = { tipo: 'var', linea: this.editor.cm.getCursor().line, primero: e };
    this.dibujar();
    return 'ok';
  }

  // Abre la línea actual como plantilla con sus partes ya puestas; se toca la que se quiere cambiar.
  editarLinea(auto = false) {
    const l = this.lineaActual;
    if (!l) return;
    if (!l.rec) return this.editarLibre(auto);
    const { plantilla, textos } = l.rec;
    const valores = textos.map(t => l.exprs.find(e => e.texto === t) ?? { texto: t });
    // se empieza por la última parte que no es un nombre nuevo (en «a = b», por b); se toca otra para cambiarla
    const primero = plantilla.huecos.map(h => h.k).lastIndexOf(plantilla.huecos.findLast(h => h.k !== 'nombre')?.k);
    // para editar, la línea no cuenta su propia declaración
    const ctx = this.contexto();
    this.armando = { plantilla, valores, linea: l.n, editando: auto ? -1 : primero < 0 ? 0 : primero, ctxLinea: { ...ctx, exprs: l.exprs } };
    if (!auto) this.dibujar();
  }

  // Si se está editando una parte de una condición con varias componentes, cuál es (índice) o null.
  componenteElegida() {
    const a = this.armando;
    if (!a || a.editando == null || a.editando < 0 || !a.posiciones) return null;
    const c = condicionDe(this.editor.cm.getLine(a.linea));
    if (!c || c.partes.length < 2) return null;
    const p = a.posiciones[a.editando];
    const k = c.rangos.findIndex(([x, y]) => p.ini >= x && p.fin <= y);
    return k < 0 ? null : k;
  }

  // Mueve la parte i de la condición a la izquierda (dir -1) o a la derecha (1), o la quita (0).
  // Los && / || se quedan en su lugar; al quitar, se va con el que la une a la anterior (o a la siguiente).
  cambiarCondicion(i, dir) {
    const s = this.seleccion();
    if (!s && !this.armando) return;
    const cm = this.editor.cm, n = this.armando?.linea ?? s.ini, L = cm.getLine(n), c = condicionDe(L);
    if (!c) return;
    const partes = [...c.partes], ops = [...c.ops];
    if (dir) {
      const j = i + dir;
      if (j < 0 || j >= partes.length) return;
      [partes[i], partes[j]] = [partes[j], partes[i]];
    } else {
      if (partes.length < 2) return;
      partes.splice(i, 1);
      ops.splice(i ? i - 1 : 0, 1);
    }
    const texto = partes.map((t, k) => t + (k < ops.length ? ` ${ops[k]} ` : '')).join('');
    cm.replaceRange(texto, { line: n, ch: c.ini }, { line: n, ch: c.fin });
    this.armando = null;
    this.componentePendiente = dir ? i + dir : null;   // al volver a editar la línea, queda elegida la que se movió
    cm.setCursor({ line: n, ch: cm.getLine(n).length });
    this.dibujar();
  }

  // Editar una línea que no es de ningún comando (por ejemplo, un while largo con &&): cada parte
  // (map->buckets[pos], NULL, key, 0…) es un hueco con su valor; se toca una y se elige la pieza nueva.
  editarLibre(auto = false) {
    const l = this.lineaActual, ctx = this.contexto();
    const sangria = (l.texto.match(/^\s*/) || [''])[0], t = l.texto.slice(sangria.length);
    const partes = partesDe(t, ctx.est);
    if (!partes.length) return;
    const tipoDe = texto => /^-?\d+$/.test(texto) ? T('long', 0) : texto === 'NULL' ? null : l.exprs.find(e => e.texto === texto) ?? null;
    // cualquier pieza sirve, pero primero las del mismo tipo (map->buckets[i]->key → también ->value)
    const huecos = partes.map(p => { const tp = tipoDe(p.texto); return { k: 'expr', libre: true, preferido: tp && (tp.ptr || esNum(tp)) ? T(tp.base, tp.ptr) : null }; });
    const trozos = []; let a = 0;
    for (const p of partes) { trozos.push(t.slice(a, p.ini)); a = p.fin; }
    trozos.push(t.slice(a));
    const plantilla = { etiqueta: trozos.map(x => x.replace(/(?<![A-Za-z0-9])_(?![A-Za-z0-9])/g, ' ')).join('_'), huecos,
      armar: v => [trozos.map((x, i) => x + (i < v.length ? v[i].texto : '')).join('')] };
    const posiciones = partes.map(p => ({ ini: p.ini + sangria.length, fin: p.fin + sangria.length }));
    let editando = auto ? -1 : 0;
    if (this.componentePendiente != null) {   // recién se movió una componente de la condición: queda elegida
      const c = condicionDe(l.texto), r = c?.rangos[this.componentePendiente];
      const k = r ? posiciones.findIndex(p => p.ini >= r[0] && p.fin <= r[1]) : -1;
      if (k >= 0) editando = k;
      this.componentePendiente = null;
    }
    this.armando = { plantilla, valores: partes.map(p => ({ texto: p.texto })), linea: l.n, editando, posiciones, ctxLinea: { ...ctx, exprs: l.exprs } };
    if (!auto) this.dibujar();
  }

  // ---- Selección (una instrucción o un bloque completo) para mover o borrar ----

  // Líneas enmascaradas y límites del cuerpo de la función donde está el cursor (null si no hay).
  cuerpoActual() {
    const cm = this.editor.cm, texto = cm.getValue();
    const fn = funcionEn(texto, cm.indexFromPos({ line: cm.getCursor().line, ch: 0 }));
    if (!fn) return null;
    return { m: enmascarar(texto).split('\n'), cab: cm.posFromIndex(fn.cuerpo).line, cierre: cm.posFromIndex(fn.fin).line };
  }
  // Línea donde se cierra la última «{» de la línea k.
  cierreDe(m, k) {
    let p = 1;
    for (let j = k + 1; j < m.length; j++) for (const ch of m[j]) { if (ch === '{') p++; else if (ch === '}' && !--p) return j; }
    return k;
  }
  // Fin de la unidad que empieza en n: la misma línea, o la } que cierra su bloque (siguiendo los else).
  finUnidad(m, n) {
    if (!/\{$/.test(m[n].trim())) return n;
    let j = this.cierreDe(m, n);
    while (/^\}\s*else\b.*\{$/.test(m[j].trim())) j = this.cierreDe(m, j);
    return j;
  }
  // Comienzo de la unidad que contiene la línea n (si n es «}» o «} else {», el if de ese bloque).
  inicioUnidad(m, n, cab) {
    let k = n;
    while (/^\}/.test(m[k].trim())) {
      let p = 1, abre = -1;
      for (let j = k - 1; j > cab && abre < 0; j--) {
        for (let x = m[j].length - 1; x >= 0; x--) {
          if (m[j][x] === '}') p++;
          else if (m[j][x] === '{' && !--p) { abre = j; break; }
        }
      }
      if (abre < 0) return n;
      k = abre;
    }
    return k;
  }
  // La selección: la unidad del cursor (o la que se armó con ＋/−).
  seleccion() {
    const b = this.cuerpoActual();
    if (!b) return null;
    const n = this.editor.cm.getCursor().line;
    if (n <= b.cab || n >= b.cierre) return null;
    // se mantiene si se armó con ＋ o recién se movió (fija); si no, es la unidad de la línea tocada
    if (this.sel?.fija && n >= this.sel.ini && n <= this.sel.fin && this.sel.fin < b.cierre) return { ...this.sel, ...b };
    const ini = this.inicioUnidad(b.m, n, b.cab);
    this.sel = { ini, fin: this.finUnidad(b.m, ini) };
    return { ...this.sel, ...b };
  }
  ampliar(mas) {
    const s = this.seleccion();
    if (!s) return;
    if (mas) {
      const sig = s.fin + 1;
      if (sig >= s.cierre || /^\}/.test(s.m[sig].trim())) return;   // termina el bloque: no hay siguiente
      this.sel.fin = this.finUnidad(s.m, sig);
      this.sel.fija = true;
    } else {
      const unidades = [];
      for (let k = s.ini; k <= s.fin; k = this.finUnidad(s.m, k) + 1) unidades.push(k);
      if (unidades.length > 1) this.sel.fin = unidades.at(-1) - 1;
    }
    this.dibujar();
  }
  // Mueve la selección: arriba/abajo de la instrucción vecina; si choca con un bloque, entra en él;
  // si llega al borde de su bloque, sale (la sangría se ajusta).
  mover(dir) {
    const s = this.seleccion();
    if (!s) return;
    const cm = this.editor.cm, L = cm.getValue().split('\n'), m = s.m;
    const bloque = L.slice(s.ini, s.fin + 1);
    let destino, sangria = 0;   // destino: índice (en L sin el bloque) donde se inserta
    const t = k => m[k].trim();
    if (dir < 0) {
      const ant = s.ini - 1;
      if (ant <= s.cab) return;
      if (/\{$/.test(t(ant))) { destino = this.inicioUnidad(m, ant, s.cab); sangria = -1; }   // primera del bloque: sale arriba
      else if (/^\}/.test(t(ant))) { destino = ant; sangria = 1; }   // bloque de arriba: entra, al final
      else destino = ant;
    } else {
      const sig = s.fin + 1;
      if (sig >= s.cierre) return;
      if (/^\}\s*else\b.*\{$/.test(t(sig))) destino = sig + 1 - bloque.length;   // pasa al else, al comienzo
      else if (/^\}/.test(t(sig))) {   // última del bloque: sale abajo, después de la }
        if (sig >= s.cierre) return;
        destino = sig + 1 - bloque.length; sangria = -1;
      }
      else if (/\{$/.test(t(sig))) { destino = sig + 1 - bloque.length; sangria = 1; }   // bloque de abajo: entra, al comienzo
      else destino = sig + 1 - bloque.length;
    }
    const nuevo = bloque.map(l => sangria > 0 ? (l.trim() ? '    ' + l : l) : sangria < 0 ? l.replace(/^ {1,4}/, '') : l);
    const resto = [...L.slice(0, s.ini), ...L.slice(s.fin + 1)];
    resto.splice(destino, 0, ...nuevo);
    const a = Math.min(s.ini, destino), b = Math.max(s.fin, destino + nuevo.length - 1);
    cm.replaceRange(resto.slice(a, b + 1).join('\n'), { line: a, ch: 0 }, { line: b, ch: L[b].length });
    this.sel = { ini: destino, fin: destino + nuevo.length - 1, fija: true };
    cm.setCursor({ line: destino, ch: cm.getLine(destino).length });
    this.dibujar();
  }
  borrarSeleccion() {
    const s = this.seleccion();
    if (!s) return;
    const cm = this.editor.cm;
    const desde = s.ini > 0 ? { line: s.ini - 1, ch: cm.getLine(s.ini - 1).length } : { line: 0, ch: 0 };
    cm.replaceRange('', desde, { line: s.fin, ch: cm.getLine(s.fin).length });
    this.sel = null;
    cm.setCursor({ line: Math.max(0, s.ini - 1), ch: cm.getLine(Math.max(0, s.ini - 1)).length });
    this.dibujar();
  }

  // Borra la línea actual; si abre un bloque, hasta su } (con el else, si lo tiene).
  borrarLinea() {
    const l = this.lineaActual;
    if (!l) return;
    const cm = this.editor.cm;
    let fin = l.n;
    if (l.texto.trim().endsWith('{')) {
      const lineas = enmascarar(cm.getValue()).split('\n');
      let p = 0;
      for (let k = l.n; k < lineas.length; k++) {
        for (const ch of lineas[k]) { if (ch === '{') p++; else if (ch === '}') p--; }
        fin = k;
        if (p <= 0) break;
      }
    }
    const desde = l.n > 0 ? { line: l.n - 1, ch: cm.getLine(l.n - 1).length } : { line: 0, ch: 0 };
    cm.replaceRange('', desde, { line: fin, ch: l.n > 0 ? cm.getLine(fin).length : 0 });
    cm.setCursor({ line: Math.max(0, l.n - 1), ch: cm.getLine(Math.max(0, l.n - 1)).length });
    cm.focus();
    this.dibujar();
  }

  // Inserta líneas donde está el cursor, con la sangría que corresponde.
  insertar(lineas, dentro, sinoDe) {
    const cm = this.editor.cm, c = cm.getCursor(), actual = cm.getLine(c.line);
    const sangria = s => (s.match(/^\s*/) || [''])[0];
    let n = c.line, ind, reemplazar = false;
    const t = actual.trim();
    const fn = funcionEn(cm.getValue(), cm.indexFromPos({ line: c.line, ch: 0 }));
    const cierreFuncion = fn && cm.posFromIndex(fn.fin).line === c.line;
    if (sinoDe) {   // else: se pega a la } del if donde está el cursor (o a la última } antes)
      let k = c.line;
      while (k >= 0 && cm.getLine(k).trim() !== '}') k--;
      if (k < 0 || (fn && cm.posFromIndex(fn.fin).line === k)) { alert('Pon el cursor en la } del if al que quieres agregarle el else.'); return; }
      const ln = cm.getLine(k), i0 = sangria(ln);
      cm.replaceRange(`${i0}} else {\n${i0}    \n${i0}}`, { line: k, ch: 0 }, { line: k, ch: ln.length });
      cm.setCursor({ line: k + 1, ch: i0.length + 4 });
      cm.focus();
      return;
    }
    if (!t) {   // línea vacía: se escribe ahí, con la sangría de la anterior
      let k = c.line - 1; while (k >= 0 && !cm.getLine(k).trim()) k--;
      const prev = k >= 0 ? cm.getLine(k) : '';
      ind = sangria(prev) + (prev.trim().endsWith('{') ? '    ' : '');
      reemplazar = true;
    } else if (cierreFuncion || t.startsWith('return')) {   // antes del cierre de la función o del return
      ind = sangria(actual) + (cierreFuncion ? '    ' : '');
    } else {   // después de la línea actual
      ind = sangria(actual) + (t.endsWith('{') ? '    ' : '');
      n = c.line + 1;
    }
    const texto = lineas.map(l => l ? ind + l : ind + '    ').join('\n');
    if (reemplazar) cm.replaceRange(texto, { line: n, ch: 0 }, { line: n, ch: actual.length });
    else cm.replaceRange(texto + '\n', { line: n, ch: 0 });
    const fila = n + (dentro ?? lineas.length - 1);
    cm.setCursor({ line: fila, ch: cm.getLine(fila).length });
    cm.focus();
  }

  // Lleva el cursor a la función elegida (si no existe, agrega su plantilla).
  irAFuncion(nombre) {
    if (!nombre) return;
    const { ej } = this.obtener();
    this.editor.abrir(ej.alumno);
    const cm = this.editor.cm;
    let texto = cm.getValue();
    if (!funcionesDefinidas(texto, [nombre]).length) {
      const paso = ej.pasos.find(p => p.funciones.includes(nombre));
      texto = agregarPlantilla(texto, paso, [nombre]);
      cm.setValue(texto);
    }
    const fn = funcionesDelArchivo(texto).find(f => f.nombre === nombre);
    if (fn) {
      const p = cm.posFromIndex(fn.cuerpo);
      if (!texto.slice(fn.cuerpo, fn.fin).trim()) {   // cuerpo vacío: una línea con sangría para empezar a escribir
        cm.replaceRange('\n    ', p, cm.posFromIndex(fn.fin));
        cm.replaceRange('\n', { line: p.line + 1, ch: 4 });
      }
      const linea = p.line + 1, l = cm.getLine(linea);
      cm.setCursor({ line: linea, ch: l.trim().startsWith('}') ? 0 : l.length });
      cm.scrollIntoView({ line: linea, ch: 0 }, 80);
    }
    cm.focus();
    this.armando = null;
    this.dibujar();
  }
}
