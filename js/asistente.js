// Asistente de comandos para el archivo del estudiante (como en Puntero C):
// se elige la función que se implementa y se arman líneas eligiendo piezas
// (variables y campos que existen en ese punto, del tipo que corresponde).
// También se puede escribir con el teclado: el asistente solo inserta líneas.
import { funcionEn, funcionesDelArchivo, variablesEn, funcionesDefinidas, agregarPlantilla, enmascarar } from './proyecto.js?v=202611181245';

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

// Plantillas: huecos que se llenan en orden; cada uno sabe qué piezas acepta.
//   nombre: un nombre nuevo · lval: algo asignable · expr: una expresión (de tipo dado) · ret: lo que retorna la función
function plantillas(est, ctors, retorno) {
  const structs = Object.keys(est);
  const out = [];
  for (const s of structs) out.push({
    cat: 'Variables', etiqueta: `${s} * _ = _;`, clase: 'decl',
    huecos: [{ k: 'nombre', sug: s === 'List' ? ['lista', 'l'] : ['nuevo', 'aux', 'actual', 'sig', 'ant', 'n'] }, { k: 'expr', tipo: () => T(s) }],
    armar: v => [`${s} * ${v[0].texto} = ${v[1].texto};`],
  });
  out.push({
    cat: 'Variables', etiqueta: 'void * _ = _;', clase: 'decl',
    huecos: [{ k: 'nombre', sug: ['dato', 'd'] }, { k: 'expr', tipo: () => T('void') }],
    armar: v => [`void * ${v[0].texto} = ${v[1].texto};`],
  });
  out.push({
    cat: 'Asignar', etiqueta: '_ = _;',
    huecos: [{ k: 'lval' }, { k: 'expr', tipo: v => T(v[0].base, v[0].ptr) }],
    armar: v => [`${v[0].texto} = ${v[1].texto};`],
  });
  for (const s of structs) out.push({
    cat: 'Memoria', etiqueta: `${s} * _ = malloc(sizeof(${s}));`, clase: 'mem',
    huecos: [{ k: 'nombre', sug: s === 'List' ? ['lista', 'l'] : ['nuevo', 'n'] }],
    armar: v => [`${s} * ${v[0].texto} = (${s} *)malloc(sizeof(${s}));`],
  });
  for (const c of ctors) out.push({
    cat: 'Memoria', etiqueta: `${c.tipo} * _ = ${c.nombre}(_);`, clase: 'mem',
    huecos: [{ k: 'nombre', sug: ['nuevo', 'n', 'aux'] }, { k: 'expr', tipo: () => T(c.param) }],
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
      const todas = plantillas(ctx.est, ej.constructores ?? [], ctx.fn.retorno);
      if (ctx.linea) {
        this.lineaActual = { ...ctx.linea, rec: reconocer(ctx.linea.texto, todas) };
        html += `<div class="fila linea-actual"><span class="nota">Línea ${ctx.linea.n + 1}:</span><code>${esc(ctx.linea.texto.trim())}</code>`
          + (this.lineaActual.rec ? '<button class="editar-linea" title="Cambiar una parte de esta línea">✎ Editar</button>' : '')
          + '<button class="borrar-linea" title="Borrar esta línea (si abre un bloque { }, el bloque completo)">🗑 Borrar</button>'
          + '<button class="deshacer" title="Deshacer (Ctrl+Z)">↶</button></div>';
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
