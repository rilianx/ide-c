// Asistente de comandos para el archivo del estudiante (como en Puntero C):
// se elige la función que se implementa y se arman líneas eligiendo piezas
// (variables y campos que existen en ese punto, del tipo que corresponde).
// También se puede escribir con el teclado: el asistente solo inserta líneas.
import { funcionEn, funcionesDelArchivo, variablesEn, funcionesDefinidas, agregarPlantilla, enmascarar } from './proyecto.js?v=202611181900';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const T = (base, ptr = 1) => ({ base, ptr });
const nombreTipo = t => t.ptr ? `${t.base} *` : t.base;
const mismo = (a, b) => a && b && a.base === b.base && a.ptr === b.ptr;

// Expresiones de puntero disponibles: variables y sus campos (hasta dos niveles: aux->next->data).
function expresiones(vars, est) {
  const out = [];
  for (const v of vars) {
    if (!v.ptr) continue;
    out.push({ texto: v.nombre, ...T(v.base, v.ptr) });
    const campos = v.ptr === 1 ? est[v.base] : null;
    if (!campos) continue;
    for (const [c, tb] of Object.entries(campos)) {
      out.push({ texto: `${v.nombre}->${c}`, ...T(tb) });
      // dos niveles solo desde un contenedor (list->head->next), no nodo→nodo→nodo
      if (est[tb] && tb !== v.base) for (const [c2, tb2] of Object.entries(est[tb])) out.push({ texto: `${v.nombre}->${c}->${c2}`, ...T(tb2) });
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
function plantillas(est, ctors, retorno, nombres = {}) {
  const structs = Object.keys(est);
  const out = [];
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
    huecos: [{ k: 'lval' }, { k: 'expr', tipo: v => T(v[0].base, v[0].ptr) }],
    armar: v => [`${v[0].texto} = ${v[1].texto};`],
  });
  for (const s of structs) out.push({
    cat: 'Memoria', etiqueta: `${s} * _ = malloc(sizeof(${s}));`, clase: 'mem',
    huecos: [{ k: 'nombre', sug: sug(s, s === 'List' ? ['lista', 'l'] : ['nuevo', 'n']) }],
    armar: v => [`${s} * ${v[0].texto} = (${s} *)malloc(sizeof(${s}));`],
  });
  for (const c of ctors) out.push({
    cat: 'Memoria', etiqueta: `${c.tipo} * _ = ${c.nombre}(_);`, clase: 'mem',
    huecos: [{ k: 'nombre', sug: sug(c.tipo, ['nuevo', 'n', 'aux']) }, { k: 'expr', tipo: () => T(c.param) }],
    armar: v => [`${c.tipo} * ${v[0].texto} = ${c.nombre}(${v[1].texto});`],
  });
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
  constructor(caja, editor, obtener, { alCambiarFuncion } = {}) {
    this.alCambiarFuncion = alCambiarFuncion;
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
    const editable = c.line > iniLinea && c.line < finLinea && /[^\s{}]/.test(linea);   // ni la cabecera, ni la } final, ni solo llaves
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
    if (hueco.k === 'lval') return exprs.map(e => ({ ...e }));
    const deseado = hueco.k === 'ret' ? fn.retorno : hueco.tipo(valores);
    let lista = exprs.filter(e => deseado ? mismo(e, deseado) : (!hueco.soloStructs || ctx.est[e.base]));
    if (!hueco.sinNull && (!deseado || deseado.ptr)) lista = [...lista, { texto: 'NULL', base: deseado?.base ?? 'void', ptr: 1 }];
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

    if (ctx.fuera) {
      html += `<p class="nota">${esc(ctx.fuera)}</p>`;
    } else if (this.armando) {
      const { plantilla, valores } = this.armando;
      const hueco = plantilla.huecos[valores.length];
      const editando = this.armando.editando;
      const actualI = editando ?? valores.length;
      const vista = plantilla.etiqueta.split('_').map((s, i, a) => esc(s) + (i < a.length - 1
        ? (i < valores.length && i !== editando ? `<b class="lleno" data-h="${i}" title="Toca para cambiar">${esc(valores[i].texto)}</b>`
          : `<span class="hueco${i === actualI ? ' actual' : ''}">${i === editando ? esc(valores[i].texto) : '_'}</span>`) : '')).join('');
      html += `<div class="fila armando">${editando != null ? `<span class="nota">Línea ${this.armando.linea + 1}:</span>` : ''}<code class="vista">${vista}</code><button class="cancelar" title="Cancelar">✕</button></div>`;
      if (editando != null) html += '<p class="nota">Elige la pieza nueva (o toca otra parte de la línea para cambiar esa).</p>';
      const piezas = this.piezas(this.armando.ctxLinea ?? ctx, plantilla.huecos[actualI], valores);
      html += `<div class="chips">${piezas.map((p, i) => `<button class="chip pieza" data-i="${i}" title="${p.base ? esc(nombreTipo(p)) : ''}">${esc(p.texto)}</button>`).join('')}`
        + (piezas.length ? '' : `<span class="nota">No hay ${plantilla.huecos[actualI].k === 'nombre' ? 'nombres libres' : 'piezas de ese tipo'} aquí.</span>`) + '</div>';
      this.piezasActuales = piezas;
    } else {
      const { ocultos = {} } = this.obtener();
      if (!this.nombres || this.nombresDe !== ej.id) {   // del código base: los .h y el código del curso
        const textos = [...ej.archivos.filter(a => a.nombre.endsWith('.h')).map(a => archivos[a.nombre]), ocultos[ej.referencia]];
        const campos = new Set(Object.values(ctx.est).flatMap(c => Object.keys(c)));
        this.nombres = nombresDelCodigo(textos, [...Object.keys(ctx.est), 'void'], campos);
        this.nombresDe = ej.id;
      }
      const todas = plantillas(ctx.est, ej.constructores ?? [], ctx.fn.retorno, this.nombres);
      const sel = ctx.linea ? this.seleccion() : null;
      this.editor.marcarSeleccion(sel ? sel.ini : null, sel?.fin);
      if (ctx.linea && sel) {
        this.lineaActual = { ...ctx.linea, rec: reconocer(ctx.linea.texto, todas) };
        const n = sel.fin - sel.ini + 1;
        const que = n === 1 ? `Línea ${sel.ini + 1}` : `Líneas ${sel.ini + 1}–${sel.fin + 1}`;
        html += `<div class="fila linea-actual"><span class="nota">${que}:</span>`
          + (n === 1 ? `<code>${esc(ctx.linea.texto.trim())}</code>` : `<code>${esc(this.editor.cm.getLine(sel.ini).trim())} …</code>`)
          + (this.lineaActual.rec && n === 1 ? '<button class="editar-linea" title="Cambiar una parte de esta línea">✎ Editar</button>' : '')
          + '<span class="grupo"><button class="mover" data-dir="-1" title="Mover arriba (si choca con un bloque, entra en él; al borde de su bloque, sale)">↑</button>'
          + '<button class="mover" data-dir="1" title="Mover abajo">↓</button>'
          + '<button class="ampliar" data-mas="1" title="Agregar a la selección la instrucción (o bloque) siguiente">＋</button>'
          + (this.finUnidad(sel.m, sel.ini) < sel.fin ? '<button class="ampliar" data-mas="0" title="Quitar la última de la selección">−</button>' : '')
          + `<button class="borrar-sel" title="Borrar lo seleccionado">🗑</button>`
          + '<button class="deshacer" title="Deshacer (Ctrl+Z)">↶</button></span></div>';
        // en un if/while: agregar a la condición con && o ||
        if (/^(\}\s*else\s+)?(if|while)\s*\(/.test(ctx.linea.texto.trim()) && n === 1 || /^(\}\s*else\s+)?(if|while)\s*\(/.test(this.editor.cm.getLine(sel.ini).trim()) && sel.ini === ctx.linea.n) {
          this.condiciones = [['&&', '!='], ['&&', '=='], ['||', '!='], ['||', '==']];
          html += `<div class="fila condicion"><span class="nota">Agregar a la condición:</span>${this.condiciones.map(([o, c], i) =>
            `<button class="chip" data-cond="${i}">${o} _ ${c} NULL</button>`).join('')}</div>`;
        }
      } else this.lineaActual = null;
      const cats = [...new Set(todas.map(p => p.cat))];
      if (!cats.includes(this.cat)) this.cat = cats[0];
      html += `<div class="fila cats">${cats.map(c => `<button class="cat${c === this.cat ? ' activa' : ''}" data-cat="${c}">${c}</button>`).join('')}</div>`;
      this.plantillasActuales = todas.filter(p => p.cat === this.cat);
      html += `<div class="chips">${this.plantillasActuales.map((p, i) => `<button class="chip ${p.clase ?? ''}" data-p="${i}">${esc(p.etiqueta)}</button>`).join('')}</div>`;
    }
    this.caja.innerHTML = html;

    this.caja.querySelectorAll('.cat').forEach(b => b.onclick = () => { this.cat = b.dataset.cat; this.dibujar(); });
    this.caja.querySelectorAll('[data-p]').forEach(b => b.onclick = () => this.empezar(this.plantillasActuales[+b.dataset.p]));
    this.caja.querySelectorAll('.pieza').forEach(b => b.onclick = () => this.elegir(this.piezasActuales[+b.dataset.i]));
    this.caja.querySelectorAll('.lleno').forEach(b => b.onclick = () => { this.armando.editando = +b.dataset.h; this.dibujar(); });
    const q = s => this.caja.querySelector(s);
    if (q('.editar-linea')) q('.editar-linea').onclick = () => this.editarLinea();
    if (q('.borrar-linea')) q('.borrar-linea').onclick = () => this.borrarLinea();
    if (q('.borrar-sel')) q('.borrar-sel').onclick = () => this.borrarSeleccion();
    this.caja.querySelectorAll('.mover').forEach(b => b.onclick = () => this.mover(+b.dataset.dir));
    this.caja.querySelectorAll('.ampliar').forEach(b => b.onclick = () => this.ampliar(b.dataset.mas === '1'));
    this.caja.querySelectorAll('[data-cond]').forEach(b => b.onclick = () => {
      const [op, cmp] = this.condiciones[+b.dataset.cond];
      this.empezar({ etiqueta: `${op} _ ${cmp} NULL`, huecos: [{ k: 'expr', tipo: () => null, sinNull: true, soloStructs: true }],
        condicion: { op, cmp, linea: this.editor.cm.getCursor().line }, armar: v => [] });
    });
    if (q('.deshacer')) q('.deshacer').onclick = () => { this.editor.cm.undo(); this.editor.cm.focus(); };
    const c = this.caja.querySelector('.cancelar'); if (c) c.onclick = () => { this.armando = null; this.dibujar(); };
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
      const { op, cmp, linea } = plantilla.condicion, cm = this.editor.cm, L = cm.getLine(linea), m = enmascarar(L);
      const r = /\b(if|while)\s*\(/.exec(m);
      if (r) {
        let p = 0, k = r.index + r[0].length - 1;
        for (; k < m.length; k++) { if (m[k] === '(') p++; else if (m[k] === ')' && !--p) break; }
        if (k < m.length) cm.replaceRange(` ${op} ${valores[0].texto} ${cmp} NULL`, { line: linea, ch: k });
      }
      cm.setCursor({ line: linea, ch: cm.getLine(linea).length });
      return this.dibujar();
    }
    this.insertar(plantilla.armar(valores), plantilla.dentro, plantilla.sinoDe);
    this.dibujar();
  }

  // Abre la línea actual como plantilla con sus partes ya puestas; se toca la que se quiere cambiar.
  editarLinea() {
    const l = this.lineaActual;
    if (!l?.rec) return;
    const { plantilla, textos } = l.rec;
    const valores = textos.map(t => l.exprs.find(e => e.texto === t) ?? { texto: t });
    // se empieza por la última parte que no es un nombre nuevo (en «a = b», por b); se toca otra para cambiarla
    const primero = plantilla.huecos.map(h => h.k).lastIndexOf(plantilla.huecos.findLast(h => h.k !== 'nombre')?.k);
    // para editar, la línea no cuenta su propia declaración
    const ctx = this.contexto();
    this.armando = { plantilla, valores, linea: l.n, editando: primero < 0 ? 0 : primero, ctxLinea: { ...ctx, exprs: l.exprs } };
    this.dibujar();
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
