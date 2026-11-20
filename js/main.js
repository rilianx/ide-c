// IDE C: arranque, ejercicios, pasos, ▶ Play y tests.
import { Editor } from './editor.js?v=202611201318';
import { Runner } from './runner.js?v=202611201318';
import { listaEjercicios, cargarEjercicio, archivosGuardados, guardar, borrarGuardado, MODO_PROFESOR, cargarSolucion } from './ejercicios.js?v=202611201318';
import { traducirMensaje } from './mensajes.js?v=202611201318';
import { modeloDe } from './modelos.js?v=202611201318';
const MOD = () => modeloDe(E?.ej);   // cómo se dibuja y compara la estructura del ejercicio
import { prepararTests, describirTest, armarTests, mismaSalida, solucionCompleta, agregarPlantilla, funcionesDefinidas, funcionesPropias, funcionesDelArchivo, armarVisual, leerVolcados, mensajes as mensajesCompilador } from './proyecto.js?v=202611201318';
import { Asistente, NOMBRES_SUGERIDOS } from './asistente.js?v=202611201318';
import { activarDivisores } from './divisores.js?v=202611201318';
import { correrTests, htmlResultados, htmlTest } from './tests.js?v=202611201318';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Markdown mínimo de los enunciados: `código`, **negrita** y párrafos.
const md = s => esc(s).split(/\n\n+/).map(p => `<p>${p.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>')}</p>`).join('');

let E = null;          // {ej, originales, ocultos}
let archivos = {};     // nombre → texto actual
let paso = 0;          // paso elegido
let estadoPasos = [];  // por paso: null | 'ok' | 'falla'
let ocupado = false;

const runner = new Runner();
runner.listo.then(() => estado('Compilador listo.'), e => estado('No se pudo cargar el compilador: ' + e.message, true));

let tSelector = null, tVisual = null;
// Avance automático (por defecto): al escribir se vuelve a ejecutar y se avanza hasta donde llega la
// función. Sin él, se ejecuta con ↻ y se avanza a mano desde el comienzo.
let avanceAuto = true;
try { avanceAuto = localStorage.getItem('ide-c:auto') !== 'no'; } catch { /* sin almacenamiento */ }
const editor = new Editor($('editor'), $('pestanas'), {
  alCambiar: (nombre, texto) => {
    archivos[nombre] = texto;
    guardar(E.ej, archivos);
    // vista en vivo: al dejar de escribir, se vuelve a ejecutar y avanza hasta donde llegue
    if (nombre === E.ej.alumno && !$('vis-panel').hidden && avanceAuto) { clearTimeout(tVisual); tVisual = setTimeout(ejecutarEnVivo, 900); }
    if (nombre === E.ej.alumno) { clearTimeout(tSelector); tSelector = setTimeout(dibujarPasos, 300); }
  },
});
const asistente = new Asistente($('asistente'), editor, () => ({ ej: E.ej, archivos, ocultos: E.ocultos }), {
  // al entrar a una función con el cursor, se elige su paso
  alCambiarFuncion: f => { const k = E.ej.pasos.findIndex(p => p.funciones.includes(f)); if (k >= 0 && k !== paso) elegirPaso(k, false); else dibujarPasos(); },
  alPiezas: textos => { elegibles = new Set(textos); marcarElegibles(); },
});

// ---------- Tocar el dibujo para elegir una pieza ----------
// Cada parte del dibujo (.toque) trae las expresiones que la nombran (map->capacity, aux->next…). Si el
// asistente espera una pieza, las partes que sirven se marcan, y tocar una la elige.
let elegibles = new Set();
// En el dibujo del test la estructura se llama como en el test (L, tree, map); en la función que se escribe,
// como su parámetro (list…): «L->current» → «list->current».
function enLaFuncion(cands) {
  const v = E?.ej?.visual?.variable, fn = asistente.contexto?.().fn;
  const p = fn?.params.find(q => q.base === E.ej.visual.tipo && q.ptr === 1)?.nombre;
  if (!v || !p || p === v) return cands;
  return [...new Set(cands.flatMap(c => c === v || c.startsWith(v + '->') || c.startsWith(v + '[') ? [p + c.slice(v.length), c] : [c]))];
}
function marcarElegibles() {
  for (const t of document.querySelectorAll('#vivo-zoom .toque, #vis-cuadros .toque'))
    t.classList.toggle('elegible', enLaFuncion(t.dataset.expr.split('|')).some(c => elegibles.has(c)));
}
for (const id of ['vivo-zoom', 'vis-cuadros']) new MutationObserver(marcarElegibles).observe(document.getElementById(id), { childList: true });
// Una flecha es parte del puntero de donde sale: se le agrega una zona para tocar (y pasar el mouse) con las
// expresiones de la zona que contiene su punto de partida.
function flechasTocables() {
  for (const svg of document.querySelectorAll('#vivo-zoom svg.memoria')) {
    if (svg.dataset.flechas) continue;
    svg.dataset.flechas = '1';
    const zonas = [...svg.querySelectorAll('rect.toque')].map(z => ({ z, x: +z.getAttribute('x'), y: +z.getAttribute('y'), w: +z.getAttribute('width'), h: +z.getAttribute('height') }));
    const capa = [];
    for (const f of svg.querySelectorAll('path.flecha')) {
      const m = /^M\s*(-?[\d.]+)[ ,](-?[\d.]+)/.exec(f.getAttribute('d') ?? '');
      if (!m) continue;
      const x = +m[1], y = +m[2];
      const dentro = zonas.filter(r => x >= r.x - 1 && x <= r.x + r.w + 1 && y >= r.y - 1 && y <= r.y + r.h + 1).sort((a, b) => a.w * a.h - b.w * b.h)[0];
      if (!dentro) continue;
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      t.setAttribute('d', f.getAttribute('d'));
      t.setAttribute('class', 'toque linea');
      t.dataset.expr = dentro.z.dataset.expr;
      capa.push(t);
    }
    svg.append(...capa);
  }
  marcarElegibles();
}
new MutationObserver(flechasTocables).observe(document.getElementById('vivo-zoom'), { childList: true, subtree: true });
// en la ventana, el dibujo (ajustado al alto) queda pegado arriba, no centrado
new MutationObserver(() => { for (const s of document.querySelectorAll('#vivo-zoom svg.memoria')) s.setAttribute('preserveAspectRatio', 'xMidYMin meet'); }).observe(document.getElementById('vivo-zoom'), { childList: true, subtree: true });
// Al pasar sobre el dibujo (o al tocarlo sin un comando abierto): cómo se llega a esa parte (L->current->data),
// con el camino destacado en el dibujo (L, su campo current, el dato del nodo).
const rotulo = document.createElement('div');
rotulo.className = 'rotulo-dibujo'; rotulo.hidden = true;
document.body.append(rotulo);
const tramosDe = x => x.match(/^[A-Za-z_]\w*|->\s*[A-Za-z_]\w*|\[[^\[\]]*\]/g) ?? [x];
function mostrarCamino(t, x, y) {
  const todas = t.dataset.expr.split('|'), corte = todas.indexOf('¦');
  const cands = corte < 0 ? todas : todas.slice(0, corte);   // los alias (no las de respaldo); como en el dibujo
  const estructura = vis?.cuadros[vis.i]?.dentro ? vis.cuadros[vis.i].fn?.lista : E.ej.visual.variable;
  // la principal: la que parte de la estructura (L->…), si hay; y otras del mismo tipo de final (aux->data)
  const delMismo = cands;
  const principal = delMismo.find(c => c.startsWith(estructura + '->') || c === estructura) ?? delMismo[0];
  const otras = delMismo.filter(c => c !== principal).slice(0, 2);
  const editando = asistente.armando?.editando >= 0;   // con una parte de la línea elegida: tocar la reemplaza
  rotulo.innerHTML = [principal, ...otras].map((c, k) => `<div>${k ? '<span>= </span>' : ''}<code>${esc(c)}</code></div>`).join('')
    + (editando ? '<div class="pista">clic: reemplaza la parte elegida</div>' : '');
  rotulo.hidden = false;
  rotulo.style.left = `${Math.min(x + 12, innerWidth - rotulo.offsetWidth - 8)}px`;
  rotulo.style.top = `${y + 16}px`;
  // el camino: cada prefijo de la expresión (L, L->current, L->current->data)
  const svg = t.closest('svg');
  svg.querySelectorAll('.toque.camino, .toque.apuntado').forEach(z => z.classList.remove('camino', 'apuntado'));
  // si es un puntero, lo apuntado (el nodo completo): las otras zonas que también se nombran así
  for (const z of svg.querySelectorAll('rect.toque')) { const cs = z.dataset.expr.split('|'); if (z !== t && cs.length > 1 && cs.includes(principal)) z.classList.add('apuntado'); }
  const ts = tramosDe(principal);
  for (let k = 1; k <= ts.length; k++) {
    const pre = ts.slice(0, k).join('');
    for (const z of svg.querySelectorAll('.toque')) if (z.dataset.expr.split('|').includes(pre)) { z.classList.add('camino'); break; }
  }
}
function ocultarCamino() {
  rotulo.hidden = true;
  document.querySelectorAll('.toque.camino, .toque.apuntado').forEach(z => z.classList.remove('camino', 'apuntado'));
}
document.addEventListener('pointerover', e => {
  if (e.pointerType !== 'mouse') return;
  const t = e.target.closest?.('#vivo-zoom .toque');
  if (t) mostrarCamino(t, e.clientX, e.clientY); else if (!rotulo.hidden) ocultarCamino();
});
let tRotulo = null;
// Menú para escoger cuando varias formas de nombrar lo tocado sirven (aux, tree->root…)
const menuDibujo = document.createElement('div');
menuDibujo.className = 'menu-dibujo'; menuDibujo.hidden = true;
document.body.append(menuDibujo);
function escoger(opciones, x, y, alElegir) {
  menuDibujo.innerHTML = '<div class="nota">¿Cuál?</div>' + opciones.map((o, k) => `<button data-k="${k}"><code>${esc(o)}</code></button>`).join('');
  menuDibujo.hidden = false;
  menuDibujo.style.left = `${Math.max(8, Math.min(x - 20, innerWidth - menuDibujo.offsetWidth - 8))}px`;
  menuDibujo.style.top = `${Math.min(y + 12, innerHeight - menuDibujo.offsetHeight - 8)}px`;
  menuDibujo.querySelectorAll('[data-k]').forEach(b => b.onclick = ev => { ev.stopPropagation(); menuDibujo.hidden = true; alElegir(opciones[+b.dataset.k]); });
}
document.addEventListener('click', e => {
  if (!menuDibujo.hidden && !e.target.closest('.menu-dibujo')) menuDibujo.hidden = true;
  const t = e.target.closest?.('#vivo-zoom .toque, #vis-cuadros .toque');
  if (!t) return;
  ocultarCamino();
  const cands = enLaFuncion(t.dataset.expr.split('|'));
  // el nombre de una variable (su etiqueta): cambiarle el nombre (si no hay un hueco esperando ni un borrador)
  const ctx = asistente.contexto();
  const variable = ctx.fn && cands.find(c => /^[A-Za-z_]\w*$/.test(c) && ctx.vars.some(v => v.nombre === c));
  const esperando = asistente.armando && asistente.armando.editando !== -1 && asistente.piezasActuales?.length;
  const enBorrador = asistente.borrador && editor.cm.getCursor().line === asistente.borrador.linea;
  if (variable && cands.every(c => /^[A-Za-z_]\w*$/.test(c)) && !esperando && !enBorrador) {
    const usados = new Set(ctx.texto.slice(ctx.fn.cuerpo, ctx.fn.fin).match(/\b[A-Za-z_]\w*\b/g) ?? []);   // los nombres que ya usa la función
    const opciones = [...NOMBRES_SUGERIDOS.filter(n => !usados.has(n)).slice(0, 6), '✎ otro…'];
    escoger(opciones, e.clientX, e.clientY, n => {
      const nuevo = n === '✎ otro…' ? prompt(`Nuevo nombre para «${variable}»:`, variable)?.trim() : n;
      if (!nuevo) return;
      if (!asistente.renombrar(variable, nuevo)) estado(`No se puede usar «${nuevo}» (no es un nombre válido o ya se usa en la función).`, true);
      else estado(`«${variable}» ahora se llama «${nuevo}».`);
    });
    menuDibujo.querySelector('.nota').textContent = `Renombrar «${variable}» a:`;
    return;
  }
  const r = asistente.tocar(cands);
  if (r?.elegir) { escoger(r.elegir, e.clientX, e.clientY, texto => asistente.tocar([texto], true)); return; }
  t.classList.add('tocado'); setTimeout(() => t.classList.remove('tocado'), 400);
  if (r === 'sin-hueco') {   // sin comando abierto: se muestra cómo se llega ahí (un rato)
    mostrarCamino(t, e.clientX, e.clientY);
    clearTimeout(tRotulo); tRotulo = setTimeout(ocultarCamino, 2500);
  }
  else if (r === 'no-sirve') estado(`${cands[0]} no sirve en este hueco (es de otro tipo).`, true);
});
activarDivisores(document.getElementById('codigo'), () => { editor.refrescar(); setTimeout(remarcarEjecucion, 0); });   // (después: vis aún no existe al iniciar)

// Letra y ajuste de líneas (se recuerdan en el navegador). En pantallas angostas, ajuste activado.
const pref = { letra: 14, ajustar: innerWidth < 1000, teclado: !matchMedia('(pointer: coarse)').matches };   // en pantallas táctiles, sin teclado
try { Object.assign(pref, JSON.parse(localStorage.getItem('ide-c:vista') || '{}')); } catch { /* sin almacenamiento */ }
function aplicarVista() {
  pref.letra = Math.min(24, Math.max(10, pref.letra));
  editor.letra(pref.letra);
  editor.ajustar(pref.ajustar);
  $('ajustar').classList.toggle('activo', pref.ajustar);
  editor.teclado(pref.teclado);
  $('teclado').classList.toggle('activo', pref.teclado);
  if (typeof ponerEnter === 'function') setTimeout(ponerEnter);   // sin teclado: ↵ al final de la línea
  try { localStorage.setItem('ide-c:vista', JSON.stringify(pref)); } catch { /* sin almacenamiento */ }
}
$('letra-menos').onclick = () => { pref.letra--; aplicarVista(); };
$('letra-mas').onclick = () => { pref.letra++; aplicarVista(); };
$('ajustar').onclick = () => { pref.ajustar = !pref.ajustar; aplicarVista(); };
// ↵ (sin teclado): un botón al final de la línea del cursor que agrega una línea nueva debajo,
// con la sangría que corresponde (en una «}», la línea va antes, dentro del bloque)
function nuevaLinea(n) {
  const cm = editor.cm, l = cm.getLine(n);
  const ind = (l.match(/^\s*/) || [''])[0] + (/\{\s*$/.test(l) ? '    ' : '');
  if (/^\s*\}/.test(l)) {
    cm.replaceRange(ind + '    \n', { line: n, ch: 0 });
    cm.setCursor({ line: n, ch: ind.length + 4 });
  } else {
    cm.replaceRange('\n' + ind, { line: n, ch: l.length });
    cm.setCursor({ line: n + 1, ch: ind.length });
  }
  cm.focus();
}
let marcaEnter = null;
function ponerEnter() {
  marcaEnter?.clear(); marcaEnter = null;
  const cm = editor.cm;
  if (pref.teclado || editor.actual !== E?.ej?.alumno || cm.getOption('readOnly') === 'nocursor') return;
  const n = cm.getCursor().line;
  const b = document.createElement('span');
  b.className = 'enter-linea'; b.textContent = '↵'; b.title = 'Nueva línea debajo';
  b.onmousedown = b.ontouchstart = e => { e.preventDefault(); e.stopPropagation(); nuevaLinea(n); };
  marcaEnter = cm.setBookmark({ line: n, ch: cm.getLine(n).length }, { widget: b });
}
editor.cm.on('cursorActivity', () => setTimeout(ponerEnter));
editor.cm.on('swapDoc', () => setTimeout(ponerEnter));

// Celular: con el teclado abierto (escribiendo en el editor) se esconde el asistente de abajo.
// El teclado se detecta por el foco del editor (con teclado activado) o porque la pantalla visible se achica.
function tecladoAbierto() {
  const vv = window.visualViewport;
  const achica = vv ? vv.height < innerHeight * 0.75 : false;
  document.body.classList.toggle('escribiendo', innerWidth <= 1000 && pref.teclado && (editor.cm.hasFocus() || achica));
  editor.refrescar();
}
editor.cm.on('focus', () => setTimeout(tecladoAbierto, 50));
editor.cm.on('blur', () => setTimeout(tecladoAbierto, 150));
window.visualViewport?.addEventListener('resize', tecladoAbierto);
$('teclado').onclick = () => { pref.teclado = !pref.teclado; aplicarVista(); if (pref.teclado) editor.cm.focus(); tecladoAbierto(); };
aplicarVista();

let tEstado = null;
function estado(texto, error = false) {
  const e = $('estado');
  e.textContent = texto;
  e.style.color = error ? 'var(--mal)' : '';
  // en el celular es un aviso flotante que se esconde solo (los errores duran más)
  e.classList.add('visible');
  clearTimeout(tEstado);
  tEstado = setTimeout(() => e.classList.remove('visible'), error ? 6000 : 2500);
}
// En el celular no hay encabezado: el selector de ejercicio va arriba de la pestaña Función
// y el estado pasa a ser un aviso flotante.
const angosto = matchMedia('(max-width: 1000px)');
// La ventana de ejecución (solo el dibujo, los puntos de los tests y ◀ ▶) es la misma en los dos: en el
// celular va sobre el editor; en el computador, en el panel derecho (en vez de la vista detallada).
function acomodar() {
  if (angosto.matches) { $('col-pasos').prepend($('ejercicio')); document.body.append($('estado')); $('editor').before($('vivo')); }
  else { document.querySelector('header h1').after($('ejercicio')); document.querySelector('header').append($('estado')); $('vis-resultado').after($('vivo')); }
}
angosto.addEventListener('change', acomodar);
acomodar();
$('estado').onclick = () => $('estado').classList.remove('visible');

function ocupar(si) {
  ocupado = si;
  for (const id of ['probar-paso', 'probar-todo', 'verificar-curso', 'vis-dibujar']) $(id).disabled = si;
  $('detener').hidden = !si;
}

// ---------- Ejercicio, pasos y funciones ----------

async function abrirEjercicio(id) {
  E = await cargarEjercicio(id);
  $('ejercicio').value = id;
  try { localStorage.setItem('ide-c:ej', id); } catch { /* sin almacenamiento */ }
  prepararTests(E.ej, E.originales);   // tests declarativos (entrada, llamadas, salida) → código y salida esperada
  if (MODO_PROFESOR) E.originales[E.ej.alumno] = solucionCompleta(E.ej, E.originales[E.ej.alumno], await pedirSolucion(E.ej));
  archivos = archivosGuardados(E.ej, E.originales);
  estadoPasos = E.ej.pasos.map(() => null);
  $('titulo-ejercicio').textContent = E.ej.titulo;
  $('descripcion').textContent = E.ej.descripcion;
  editor.cargar(E.ej.archivos.map(a => ({ nombre: a.nombre, texto: archivos[a.nombre], editable: a.editable })));
  elegirPaso(0, false);
  $('resumen-tests').textContent = '';
  asistente.dibujar();
}

// El selector de arriba: todas las funciones de los pasos, con su estado.
// Elegir una lleva a su paso; si aún no está en el archivo, se crea con su plantilla.
function dibujarPasos() {
  const texto = archivos[E.ej.alumno] ?? '';
  const enArchivo = new Set(funcionesDefinidas(texto, E.ej.funciones));
  const propias = new Set(funcionesPropias(E.ej, texto));
  const actual = asistente.fnAnterior && E.ej.pasos[paso].funciones.includes(asistente.fnAnterior) ? asistente.fnAnterior : E.ej.pasos[paso].funciones[0];
  $('funcion').innerHTML = E.ej.pasos.flatMap((p, k) => p.funciones.map(f => {
    const marca = estadoPasos[k] === 'ok' ? ' ✅' : estadoPasos[k] === 'falla' ? ' ❌' : '';
    const nota = !enArchivo.has(f) ? '  + crear' : !propias.has(f) ? '  (vacía)' : '';
    return `<option value="${f}"${f === actual ? ' selected' : ''}>${k + 1}. ${f}${marca}${nota}</option>`;
  })).join('');
}
$('funcion').onchange = () => {
  if (!E) return;   // aún cargando el ejercicio
  const f = $('funcion').value, k = E.ej.pasos.findIndex(p => p.funciones.includes(f));
  if (k >= 0) elegirPaso(k, true, f);
};

function elegirPaso(k, conFoco = true, fn = null) {
  paso = k;
  const p = E.ej.pasos[k];
  const faltan = p.funciones.filter(f => !funcionesDefinidas(archivos[E.ej.alumno], [f]).length);
  $('enunciado').innerHTML = md(p.enunciado) + (faltan.length
    ? `<button id="escribir">✎ Escribir ${faltan.map(f => `<code>${f}</code>`).join(' y ')} en ${E.ej.alumno}</button>`
    : `<p class="descripcion">Ya está en ${E.ej.alumno} (<a href="#" id="ir-codigo">ir al código</a>): ▶ Probar actual para revisarla.</p>`);
  if (!faltan.length) $('ir-codigo').onclick = e => { e.preventDefault(); asistente.irAFuncion(p.funciones[0]); irPestana('centro'); };
  if (faltan.length) $('escribir').onclick = () => {
    editor.abrir(E.ej.alumno);
    editor.poner(E.ej.alumno, agregarPlantilla(editor.texto(E.ej.alumno), p));
    asistente.irAFuncion(faltan[0]);
    elegirPaso(k, false);
    irPestana('centro');
  };
  dibujarPasos();
  // al elegir otra función: la vista en vivo con su primer test
  if (E.ej.visual) {
    if (!visElegido || +visElegido.split('.')[0] !== k || $('vis-panel').hidden) { abrirVisual(`${k}.0`, avanceAuto ? 'auto' : 'inicio', !avanceAuto); if (avanceAuto) ejecutarEnVivo(); }
  }
  else if (testsMostrados !== k) mostrarTestsSinCorrer();
  if (conFoco) { asistente.irAFuncion(fn ?? p.funciones[0]); if (faltan.length) elegirPaso(k, false); }
}

// ---------- Mensajes del compilador ----------

function htmlCompilacion(lista, titulo, avisos = false) {
  if (!lista?.length) return '';
  const visibles = new Set(E.ej.archivos.map(a => a.nombre));
  const lineas = lista.map(m => {
    const donde = m.archivo && visibles.has(m.archivo)
      ? `<a data-archivo="${esc(m.archivo)}" data-linea="${m.linea}">${esc(m.archivo)}:${m.linea}</a>: ` : '';
    const t = traducirMensaje(m.texto);   // en castellano, con el original en chico
    return t.texto ? `<div>${donde}${esc(t.texto)} <span class="original" title="Mensaje original del compilador">(${esc(m.texto)})</span></div>`
      : `<div>${donde}${esc(m.texto)}</div>`;
  }).join('');
  return `<div class="compilacion${avisos ? ' avisos' : ''}"><h4>${titulo}</h4>${lineas}</div>`;
}

function mostrarCompilacion(contenedor, lista, ok) {
  contenedor.innerHTML = ok ? htmlCompilacion(lista, 'Advertencias', true) : htmlCompilacion(lista, 'No compila');
  contenedor.querySelectorAll('a[data-archivo]').forEach(a => a.onclick = () => editor.abrir(a.dataset.archivo, +a.dataset.linea));
  editor.marcarErrores(ok ? [] : (lista ?? []).filter(m => m.archivo));
}

// Los errores de ejecución, en castellano.
function traducir(error) {
  return error
    .replace('Runtime error: NULL pointer dereference', 'Error de ejecución: se desreferenció un puntero NULL')
    .replace('Runtime error: array index out of bounds', 'Error de ejecución: índice fuera del arreglo')
    .replace('Runtime error: division by zero', 'Error de ejecución: división por cero')
    .replace('Runtime error: stack overflow (infinite recursion?)', 'Error de ejecución: se llenó la pila (¿recursión infinita?)')
    .replace('Runtime error: invalid memory access', 'Error de ejecución: acceso a memoria inválido')
    .replace('Runtime error:', 'Error de ejecución:');
}

// ---------- Tests ----------

// La lista de tests de la función elegida, antes de correrlos (cada uno con su «👁 Ver»).
let testsMostrados = null;
function mostrarTestsSinCorrer() {
  testsMostrados = paso;
  const tests = E.ej.pasos[paso].tests.map((t, idx) => ({ ...t, paso, idx }));
  cerrarVisual();
  $('compilacion-tests').innerHTML = '';
  $('resumen-tests').textContent = '';
  $('resultados').innerHTML = `<p class="nota">Tests de <code>${esc(E.ej.pasos[paso].funciones.join(', '))}</code>: ▶ Probar actual los corre; 👁 Ver ejecuta uno paso a paso y muestra la memoria.</p>`
    + htmlResultados(tests, tests.map(() => ({ estado: 'sin-correr', obtenido: '', error: null })));
}

// todos: false = la función elegida · true = las que escribió el estudiante
// · 'curso' = todos los tests con el código oculto del curso (sin las funciones del estudiante)
async function probar(todos) {
  if (ocupado) return;
  ocupar(true);
  const curso = todos === 'curso';
  // «todos»: los pasos de las funciones que escribió el estudiante (no las plantillas vacías)
  const propias = new Set(funcionesPropias(E.ej, archivos[E.ej.alumno] ?? ''));
  const pasos = curso ? E.ej.pasos.map((p, k) => k) : todos ? E.ej.pasos.map((p, k) => k).filter(k => E.ej.pasos[k].funciones.some(f => propias.has(f))) : [paso];
  if (!todos && !E.ej.pasos[paso].funciones.some(f => propias.has(f))) {
    const f = E.ej.pasos[paso].funciones.join(' y ');
    estado(`Aún no implementas ${f}: escríbela en ${E.ej.alumno} antes de probarla.`, true);
    $('resultados').innerHTML = `<p class="nota">Aún no implementas <code>${esc(f)}</code> (no está en ${esc(E.ej.alumno)} o está vacía). Escríbela y vuelve a tocar ▶ Probar actual.<br>Si quieres ver que los tests pasan con la versión del curso, usa ✔ Verificar código del curso.</p>`;
    $('resumen-tests').textContent = '';
    ocupar(false); return;
  }
  if (!pasos.length) { estado('Aún no has escrito ninguna función: elige un paso y toca ✎ Escribir.', true); ocupar(false); return; }
  const tests = pasos.flatMap(k => E.ej.pasos[k].tests.map((t, idx) => ({ ...t, paso: k, idx })));
  cerrarVisual();
  testsMostrados = todos ? null : paso;
  $('compilacion-tests').innerHTML = '';
  estado('Compilando y probando…');
  const dibujar = res => {
    ultimo = { tests, res, codigo: curso ? '(código del curso)' : archivos[E.ej.alumno] };
    $('copiar-reporte').hidden = false;
    $('resultados').innerHTML = htmlResultados(tests, res.map(r => ({ ...r, error: r.error && traducir(r.error) })));
    const ok = res.filter(r => r.estado === 'ok').length;
    $('resumen-tests').textContent = `${ok}/${tests.length}`;
  };
  try {
    const aProbar = curso ? { ...archivos, [E.ej.alumno]: '' } : archivos;   // list.c vacío: todo usa el código del curso
    const { compilacion, resultados } = await correrTests(runner, E.ej, aProbar, E.ocultos, tests, dibujar);
    const compilo = !resultados.some(r => r.estado === 'sin-compilar');
    mostrarCompilacion($('compilacion-tests'), compilacion, compilo);
    if (!curso) for (const k of pasos) {
      const delPaso = resultados.filter((r, i) => tests[i].paso === k);
      estadoPasos[k] = delPaso.every(r => r.estado === 'ok') ? 'ok' : 'falla';
    }
    dibujarPasos();
    const ok = resultados.filter(r => r.estado === 'ok').length;
    estado((curso ? 'Código del curso: ' : '') + (compilo ? `${ok} de ${tests.length} tests pasan.` : 'No compila.'), !compilo || ok < tests.length);
  } catch (e) {
    estado('No se pudo probar: ' + e.message, true);
    $('resultados').innerHTML = htmlResultados(tests, tests.map(() => ({ estado: 'sin-compilar', obtenido: '', error: null })));
  }
  ocupar(false);
}

// Reporte en texto (código + resultados), para pedir ayuda.
let ultimo = null;
function reporte() {
  const { tests, res, codigo } = ultimo;
  const marca = { ok: 'OK', falla: 'FALLA', error: 'ERROR', pendiente: 'PENDIENTE', 'sin-compilar': 'NO COMPILÓ' };
  const partes = tests.map((t, i) => {
    const r = res[i] ?? {};
    let s = `[${marca[r.estado] ?? r.estado}] ${t.nombre}`;
    if (r.estado === 'falla' || r.estado === 'error')
      s += `\n  código:\n${t.codigo.replace(/^/gm, '    ')}\n  esperado:\n${t.esperado.replace(/^/gm, '    ')}\n  obtenido:\n${(r.obtenido || '(nada)').replace(/^/gm, '    ')}` + (r.error ? `\n  ${traducir(r.error)}` : '');
    return s;
  });
  const comp = $('compilacion-tests').innerText.trim();
  return `${E.ej.titulo ?? E.ej.id}\n\n==== ${E.ej.alumno} ====\n${codigo}\n\n` + (comp ? `==== Compilador ====\n${comp}\n\n` : '') + `==== Tests ====\n${partes.join('\n')}\n`;
}
$('copiar-reporte').onclick = async () => {
  if (!ultimo) return;
  const texto = reporte();
  try { await navigator.clipboard.writeText(texto); estado('Reporte copiado: pégalo en un mensaje o correo.'); }
  catch { prompt('Copia el reporte:', texto); }
};

// ---------- Paneles, vistas y botones ----------

// ---------- Visualización ----------

// La visualización se abre en el panel de Tests, desde el botón «👁 Ver» de cada test.
let visElegido = null;
// Vista en vivo: el panel derecho ejecuta un test con el código actual y se para en la última línea
// que alcanzó a correr la función del ejercicio (o en la que falló). Se vuelve a ejecutar sola al
// escribir. posicion: 'auto' (eso), 'mantener' (el paso en que estaba) o 'inicio'.
function abrirVisual(clave, posicion = avanceAuto ? 'auto' : 'inicio', ejecutar = true) {
  if (!E.ej.visual) { estado('Este ejercicio aún no tiene visualización.', true); return; }
  const [k] = clave.split('.').map(Number);
  if (visElegido?.split('.')[0] !== String(k) || !$('vis-test-sel').options.length)
    $('vis-test-sel').innerHTML = E.ej.pasos[k].tests.map((t, i) => `<option value="${k}.${i}">${esc(t.nombre)}</option>`).join('');
  visElegido = clave;
  $('vis-test-sel').value = clave;
  $('vista-tests').hidden = true;
  $('vis-panel').hidden = false;
  $('col-tests').classList.add('visualizando');
  if (ejecutar) dibujarVisual(true, posicion);
}
$('vis-test-sel').onchange = () => abrirVisual($('vis-test-sel').value);
$('vis-siguiente-test').onclick = () => {   // al siguiente test de la función (después del último, vuelve al primero)
  const s = $('vis-test-sel');
  s.selectedIndex = (s.selectedIndex + 1) % s.options.length;
  abrirVisual(s.value);
};
$('vis-auto').checked = avanceAuto;
$('vis-auto').onchange = e => {
  avanceAuto = e.target.checked;
  try { localStorage.setItem('ide-c:auto', avanceAuto ? 'si' : 'no'); } catch { /* sin almacenamiento */ }
  if (!avanceAuto) return;
  if (vis && visDibujado?.test === visElegido && visDibujado.codigo === (archivos[E.ej.alumno] ?? '')) { vis.i = pasoAuto(); mostrarPaso(); }
  else dibujarVisual(true, 'auto');
};
function cerrarVisual() { $('vis-panel').hidden = true; $('vista-tests').hidden = false; $('col-tests').classList.remove('visualizando'); editor.marcarEjecucion(null, null); mostrarVivo(); }
$('vis-volver').onclick = () => { cerrarVisual(); if (testsMostrados !== paso) mostrarTestsSinCorrer(); };
$('vis-dibujar').onclick = () => dibujarVisual(false, avanceAuto ? 'auto' : 'inicio');
$('resultados').addEventListener('click', e => {
  const b = e.target.closest('.ver-vis');
  if (b) { e.preventDefault(); e.stopPropagation(); abrirVisual(b.dataset.vis); }
});

// Dibuja el test elegido. Si la función del paso es del estudiante, también se ve por dentro
// (línea a línea en su archivo, con sus variables) en cada línea del test que la llama.
let visDibujado = null;   // {test, codigo}: para no volver a dibujar si nada cambió
let visPendiente = null;   // si llega un pedido mientras se ejecuta otro, se hace después
async function dibujarVisual(soloSiCambio = false, posicion = 'auto') {
  if (ocupado) { visPendiente = [soloSiCambio, posicion]; return; }
  const [k, i] = visElegido.split('.').map(Number);
  const test = E.ej.pasos[k].tests[i];
  const codigoAlumno = archivos[E.ej.alumno] ?? '';
  if (soloSiCambio && visDibujado?.test === visElegido && visDibujado.codigo === codigoAlumno) return;
  const lineasTest = test.codigo.split('\n'), lineasAlumno = codigoAlumno.split('\n');
  const propias = new Set(funcionesPropias(E.ej, codigoAlumno));
  // se puede entrar a todas las funciones que escribió el estudiante (no solo a la del paso)
  const lineaDe = pos => codigoAlumno.slice(0, pos).split('\n').length;
  const fns = funcionesDelArchivo(codigoAlumno).filter(f => propias.has(f.nombre)).map(f => ({
    nombre: f.nombre, cabecera: lineaDe(f.cuerpo), fin: lineaDe(f.fin),
    lista: f.params.find(q => q.base === E.ej.visual.tipo && q.ptr === 1)?.nombre
      ?? new RegExp(`\\b${E.ej.visual.tipo}\\s*\\*\\s*(\\w+)`).exec(codigoAlumno.slice(f.cuerpo, f.fin))?.[1] ?? 'list',
  }));
  const detalle = fns.length ? fns.map(f => f.nombre) : null;
  const delPaso = E.ej.pasos[k].funciones.filter(f => propias.has(f));
  ocupar(true);
  resultadoVivo('<span class="nota">Ejecutando…</span>');
  const caja = $('vis-cuadros');
  try {
    let r = await runner.ejecutar(armarVisual(E.ej, archivos, E.ocultos, test, detalle));
    let sinDetalle = false;
    if (!r.compilado?.ok) {
      // ¿el error es del código del estudiante? se compila tal cual: así el mensaje muestra su código
      const tal = await runner.ejecutar(armarTests(E.ej, archivos, E.ocultos, [test]));
      if (!tal.compilado?.ok) r = tal;
      else if (detalle) {   // compila tal cual: falló la instrumentación de sus funciones; se intenta sin ella
        const r2 = await runner.ejecutar(armarVisual(E.ej, archivos, E.ocultos, test, null));
        if (r2.compilado?.ok) { sinDetalle = mensajesDe(r).map(x => (x.archivo ? `${x.archivo}:${x.linea}: ` : '') + x.texto).slice(0, 3).join('\n') || true; r = r2; }
      }
    }
    if (!r.compilado?.ok) {   // no compila (por ejemplo, a medio escribir): se deja el último dibujo, atenuado
      mostrarCompilacion($('vis-compilacion'), mensajesDe(r), false);
      caja.classList.add('desactualizado');
      // en la ventana del celular: el primer error (en castellano) y, si había, el último dibujo atenuado
      const m1 = mensajesDe(r).find(x => x.archivo === E.ej.alumno) ?? mensajesDe(r)[0];
      const t1 = m1 ? (traducirMensaje(m1.texto).texto ?? m1.texto) : '';
      const previo = $('vivo-zoom').querySelector('.vivo-fila');
      $('vivo-zoom').innerHTML = `<div class="vivo-error">⚠ No compila${m1?.linea ? ` (línea ${m1.linea})` : ''}: ${esc(t1)}</div>` + (previo ? `<div class="desactualizado">${previo.outerHTML}</div>` : '');
      $('vivo').classList.remove('pasa'); $('vivo').classList.add('falla'); $('vivo-nota').innerHTML = '';
      vivoMensaje = true; mostrarVivo();
      resultadoVivo('<span class="res-mal">⚠ No compila: revisa el mensaje.</span>');
      visDibujado = { test: visElegido, codigo: codigoAlumno };
    } else {
      $('vis-compilacion').innerHTML = '';
      caja.classList.remove('desactualizado');
      vivoMensaje = false;
      const d = r.llamadas.get(0) ?? {};
      const { salida, cuadros, ultima, falla } = leerVolcados(d.stdout);
      // si se cayó (o la revisión de punteros lo detuvo): un último paso en la línea que falló,
      // con la memoria de justo antes
      const seCayo = !!(d.error || !d.ok || falla);
      if (seCayo && ultima) cuadros.push({ ...ultima, error: true, estado: cuadros.at(-1)?.estado ?? null, salida });
      const textoFalla = falla && { NULL: 'Error de ejecución: se siguió un puntero NULL (->)', BASURA: 'Error de ejecución: se siguió un puntero con basura (->)', LIBERADO: 'Error de ejecución: se usó un nodo ya liberado (->)' }[falla.tipo];
      const aviso = sinDetalle ? `<p class="nota">No se pudo preparar la vista por dentro de tus funciones (hay una línea que no supe instrumentar); se muestra solo el test.</p>${typeof sinDetalle === 'string' ? `<details class="nota"><summary>Detalle (para el profesor)</summary><pre>${esc(sinDetalle)}</pre></details>` : ''}`
        : !delPaso.length ? `<p class="nota">Tu <code>${esc(E.ej.pasos[k].funciones.join(', '))}</code> aún no está escrita: el test usa la del curso y no se puede entrar a ella.</p>` : '';
      // a qué función pertenece cada volcado de adentro (por su línea) y qué llamada es
      const cuenta = new Map();
      for (const c of cuadros) if (c.dentro) {
        const f = fns.find(f => c.linea >= f.cabecera && c.linea <= f.fin) ?? fns[0];
        c.fn = f;
        if (c.linea === f.cabecera && !c.condicion && !c.error) cuenta.set(f.nombre, (cuenta.get(f.nombre) ?? 0) + 1);
        c.llamada = Math.max(cuenta.get(f.nombre) ?? 0, 1);
      }
      for (const c of cuadros) if (c.dentro) c.llamadas = cuenta.get(c.fn.nombre) ?? 1;
      const antes = posicion === 'mantener' && vis ? vis.i : -1;
      vis = { cuadros, i: Math.min(antes, cuadros.length - 1), test, lineasTest, lineasAlumno, aviso, fns, paso: k,
        error: textoFalla ?? (seCayo ? traducir(d.error ?? d.stderr ?? 'No se pudo ejecutar') : null) };
      vis.salidaFinal = salida;
      vis.sinEscribir = !delPaso.length;
      vis.lugares = MOD().lugares(cuadros.map(c => c.estado));   // cada nodo en un lugar fijo durante toda la ejecución
      if (posicion === 'auto') vis.i = pasoAuto();
      if (posicion === 'cursor') vis.i = pasoCursor() ?? pasoAuto();
      if (irAEntrada) {   // deslizar en el celular: la línea de definición de la función (su entrada)
        irAEntrada = false;
        const fnsPaso = E.ej.pasos[k].funciones;
        const j = cuadros.findIndex(c => c.dentro && !c.condicion && fnsPaso.includes(c.fn?.nombre) && c.linea === c.fn.cabecera);
        if (j >= 0) { vis.i = j; const l = cuadros[j].fn.cabecera - 1; editor.cm.setCursor({ line: l, ch: editor.cm.getLine(l).length }); }
      }
      const pasa = !seCayo && mismaSalida(test.esperado, salida);
      vis.pasa = pasa;   // antes de dibujar: la ventana se tiñe verde o roja según esto
      mostrarPaso();
      visDibujado = { test: visElegido, codigo: codigoAlumno };
      if (vis.sinEscribir) resultadoVivo(`<span class="nota">✎ Escribe tu ${esc(E.ej.pasos[k].funciones.join(', '))}: arriba, la entrada y cómo debe quedar</span>`);
      else resultadoVivo(seCayo ? '<span class="res-mal">💥 El test se cae (ver la línea marcada)</span>'
        : pasa ? '<span class="res-bien">✅ Este test pasa</span>' : (test.salida ? '<span class="res-mal">❌ Todavía no: mira lo marcado en rojo al final</span>' : '<span class="res-mal">❌ Todavía no: compara Esperado y Obtenido</span>'));
    }
  } catch (e) {
    estado('No se pudo ejecutar: ' + e.message, true);
    resultadoVivo('');
  }
  ocupar(false);
  if (visPendiente) { const p = visPendiente; visPendiente = null; if (p[0] === 'vivo') ejecutarEnVivo(); else dibujarVisual(...p); }
}

// Dónde pararse: en la línea que falló; si no, al final de la primera llamada a la función del
// ejercicio (lo último que alcanzó a correr); si no está escrita, en la línea del test que la llama.
function pasoAuto() {
  const C = vis.cuadros, fnsPaso = E.ej.pasos[vis.paso].funciones;
  if (C.at(-1)?.error) return C.length - 1;
  const j = C.findIndex(c => c.dentro && fnsPaso.includes(c.fn?.nombre));
  if (j >= 0) { vis.i = j; return finDeLlamada(j); }
  const re = new RegExp(`\\b(${fnsPaso.join('|')})\\s*\\(`);
  const t = C.findIndex(c => !c.dentro && re.test(vis.lineasTest[c.linea - 1] ?? ''));
  return t >= 0 ? t : C.length - 1;
}

// Después de editar: el momento justo después de la línea donde está el cursor (en la primera llamada),
// para ver ahí lo recién escrito (una variable declarada dentro de un ciclo ya no existe al final).
function pasoCursor() {
  if (editor.actual !== E.ej.alumno) return null;
  const linea = editor.cm.getCursor().line + 1, C = vis.cuadros, fnsPaso = E.ej.pasos[vis.paso].funciones;
  if (C.at(-1)?.error) return null;
  const j0 = C.findIndex(c => c.dentro && fnsPaso.includes(c.fn?.nombre));
  if (j0 < 0) return null;
  const fn = C[j0].fn;
  if (linea <= fn.cabecera || linea > fn.fin) return null;
  // la primera vez que se pasa por esa línea o, si no se alcanza, por una posterior; si no, por una anterior
  const enLlamada = C.map((c, k) => [c, k]).filter(([c]) => c.dentro && !c.condicion && !c.error && c.fn === fn && c.llamada === C[j0].llamada);
  const sig = enLlamada.filter(([c]) => c.linea >= linea).sort((a, b) => a[0].linea - b[0].linea || a[1] - b[1])[0];
  if (sig) return sig[1];
  const ant = enLlamada.filter(([c]) => c.linea < linea);
  return ant.length ? ant.at(-1)[1] : null;
}

// ---------- Tocar una línea de la función: la ejecución vuelve (o va) a ese momento ----------
let tLinea = null, tocado = 0;   // solo cuando el estudiante toca o mueve el cursor (no cuando lo mueve la app)
for (const ev of ['mousedown', 'touchstart', 'keydown']) editor.cm.getWrapperElement().addEventListener(ev, () => { tocado = Date.now(); }, true);
editor.cm.on('cursorActivity', () => {
  clearTimeout(tLinea);
  if (Date.now() - tocado > 1500) return;
  tLinea = setTimeout(() => {
    if (!ejecucionVisible() || editor.actual !== E.ej.alumno || ocupado) return;
    const linea = editor.cm.getCursor().line + 1, act = vis.cuadros[vis.i];
    if (act?.dentro && act.linea === linea) return;
    const candidatos = vis.cuadros.map((c, k) => [c, k]).filter(([c]) => c.dentro && !c.error && c.linea === linea && !c.condicion || c.dentro && c.condicion && c.linea === linea);
    if (!candidatos.length) return;
    // de preferencia en la misma llamada que se está viendo
    const misma = candidatos.find(([c]) => act?.dentro && c.fn === act.fn && c.llamada === act.llamada);
    vis.i = (misma ?? candidatos[0])[1];
    mostrarPaso();
  }, 250);
});

// ---------- Ventana de ejecución en la pestaña Código (celular) ----------
let vivoCerrado = false, resumenVivo = '';
// Tests de la función en la ventana: «1/3» y un punto por test (verde pasa, rojo no; el que se ve, marcado)
let estadosVivo = null;   // {paso, estados: ['ok', 'falla', …]}
function pintarTestsVivo() {
  const caja = $('vivo-tests');
  if (!estadosVivo || estadosVivo.paso !== paso) { caja.innerHTML = ''; return; }
  const { estados } = estadosVivo, actual = visElegido && +visElegido.split('.')[0] === paso ? +visElegido.split('.')[1] : -1;
  const ok = estados.filter(e => e === 'ok').length;
  caja.innerHTML = `<b class="${ok === estados.length ? 'res-bien' : ''}">${ok}/${estados.length}</b>`
    + estados.map((e, i) => `<button class="punto-test ${e === 'ok' ? 'ok' : 'mal'}${i === actual ? ' actual' : ''}" data-t="${i}" title="Test ${i + 1}${e === 'ok' ? ' (pasa)' : ' (no pasa)'}: ${esc(E.ej.pasos[paso].tests[i]?.nombre ?? '').replace(/"/g, '&quot;')}"></button>`).join('');
  caja.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { irAEntrada = true; abrirVisual(`${paso}.${b.dataset.t}`); });
}
// El resultado del test, en el panel y en la ventana sobre el editor.
function resultadoVivo(html) {
  $('vis-resultado').innerHTML = html + (resumenVivo ? ` <span class="nota">· ${esc(resumenVivo)}</span>` : '');
  $('vivo-res').innerHTML = html + (resumenVivo ? ` <span class="nota">· ${esc(resumenVivo)}</span>` : '');
}
// Vuelve a poner (o quitar) la marca amarilla según si la ejecución se ve.
function remarcarEjecucion() {
  if (!vis || !E) return;
  const c = vis.cuadros[vis.i];
  editor.marcarEjecucion(E.ej.alumno, ejecucionVisible() && c?.dentro ? c.linea : null);
}
// ¿Se está viendo la ejecución? (celular: la ventana abierta; computador: la columna de tests visible)
function ejecucionVisible() {
  if (!vis || $('vis-panel').hidden) return false;
  return innerWidth <= 1000 ? !vivoCerrado : !$('codigo').classList.contains('sin-der');
}
function mostrarVivo() {
  $('vivo').hidden = vivoCerrado || (!vis && !vivoMensaje) || $('vis-panel').hidden; $('vivo-abrir').hidden = !vivoCerrado;
  document.body.classList.toggle('con-vivo', !$('vivo').hidden);   // celular: sin las barras de arriba, el dibujo parte arriba
}
// ☰ en la ventana: muestra (u oculta) las barras de arriba (pestañas, archivos, letra, teclado)
$('vivo-menu').onclick = () => document.body.classList.toggle('barras');
let vivoMensaje = false;   // la ventana tiene algo que decir aunque no haya ejecución (no compila)
// al cerrar la ventana, el editor deja de marcar la línea de la ejecución (queda el marcado de bloques)
$('vivo-cerrar').onclick = () => { vivoCerrado = true; mostrarVivo(); editor.marcarEjecucion(null, null); };
// ◀ ▶ en la ventana: un paso de la ejecución (también dentro de los ciclos), y el editor va a esa línea
const pasoVivo = d => {
  if (!vis || vivoMensaje) return;
  const j = Math.max(0, Math.min(vis.cuadros.length - 1, vis.i + d));
  if (j === vis.i) return;
  vis.i = j; mostrarPaso();
  const c = vis.cuadros[j];
  if (c?.dentro) editor.cm.scrollIntoView({ line: c.linea - 1, ch: 0 }, 60);
};
$('vivo-atras').onclick = () => pasoVivo(-1);
$('vivo-sig').onclick = () => pasoVivo(1);
$('vivo-abrir').onclick = () => { vivoCerrado = false; mostrarVivo(); if (vis) mostrarPaso(); };
// Gestos en el dibujo: dos dedos acercan/alejan, doble toque vuelve al tamaño normal y deslizar
// hacia el lado cambia de test (y deja el cursor en la definición de la función: la entrada).
{
  const caja = $('vivo-cuerpo'), dedos = new Map();
  let zoom = 1, inicio = null, pellizco = null, ultimoToque = 0;
  // se escala el dibujo sin cambiar su ancho (así los dibujos crecen igual que las letras) y se recorre con el dedo
  // centro (x, y en pantalla): ese punto del dibujo queda bajo los dedos
  const aplicarZoom = (centro = null) => {
    const z = $('vivo-zoom'), r = caja.getBoundingClientRect(), antes = parseFloat(z.dataset.zoom || '1');
    const px = centro ? centro.x - r.left : 0, py = centro ? centro.y - r.top : 0;
    const cx = (caja.scrollLeft + px) / antes, cy = (caja.scrollTop + py) / antes;   // en coordenadas del dibujo
    z.dataset.zoom = zoom;
    z.style.width = zoom > 1 ? `${caja.clientWidth}px` : '';
    z.style.transform = zoom > 1 ? `scale(${zoom})` : '';
    caja.style.touchAction = zoom > 1 ? 'pan-x pan-y' : '';
    // (la ventana tiene alto fijo: con zoom, el dibujo se recorre con el dedo)
    if (centro) { caja.scrollLeft = cx * zoom - px; caja.scrollTop = cy * zoom - py; }
  };
  caja.addEventListener('pointerdown', e => {
    dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dedos.size === 1) inicio = { x: e.clientX, y: e.clientY, t: Date.now() };
    if (dedos.size === 2) { const [a, b] = [...dedos.values()]; pellizco = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom }; inicio = null; }
  });
  caja.addEventListener('pointermove', e => {
    if (!dedos.has(e.pointerId)) return;
    dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pellizco && dedos.size === 2) {
      const [a, b] = [...dedos.values()];
      zoom = Math.min(3, Math.max(1, pellizco.z * Math.hypot(a.x - b.x, a.y - b.y) / pellizco.d));
      aplicarZoom({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    }
  });
  const soltar = e => {
    dedos.delete(e.pointerId);
    if (dedos.size < 2) pellizco = null;
    if (!inicio || dedos.size) return;
    const dx = e.clientX - inicio.x, dy = e.clientY - inicio.y;
    if (zoom === 1 && Math.abs(dx) > 50 && Math.abs(dx) > 2 * Math.abs(dy)) cambiarTest(dx < 0 ? 1 : -1);
    else if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && !e.target.closest?.('.toque.elegible')) {   // toque: doble toque = tamaño normal
      if (Date.now() - ultimoToque < 350) { zoom = zoom > 1 ? 1 : 2; aplicarZoom({ x: e.clientX, y: e.clientY }); }
      ultimoToque = Date.now();
    }
    inicio = null;
  };
  caja.addEventListener('pointerup', soltar);
  caja.addEventListener('pointercancel', soltar);
}
// Pasa al test siguiente (+1) o anterior (−1) y se para en la entrada de la función del ejercicio.
function cambiarTest(dir) {
  const s = $('vis-test-sel'), n = s.options.length;
  if (!n) return;
  s.selectedIndex = (s.selectedIndex + dir + n) % n;
  irAEntrada = true;
  abrirVisual(s.value);
}
let irAEntrada = false;

// Con avance automático: se corren todos los tests de la función y se muestra el primero que falla.
async function ejecutarEnVivo() {
  if (ocupado) { visPendiente = ['vivo']; return; }
  const k = paso, tests = E.ej.pasos[k].tests.map((t, idx) => ({ ...t, paso: k, idx }));
  ocupar(true);
  let res = null;
  try { res = (await correrTests(runner, E.ej, archivos, E.ocultos, tests)).resultados; } catch { /* se ve al dibujar */ }
  ocupar(false);
  if (res && !res.some(r => r.estado === 'sin-compilar')) {
    const ok = res.filter(r => r.estado === 'ok').length;
    resumenVivo = `${ok}/${tests.length} tests pasan`;
    const escrita = E.ej.pasos[k].funciones.some(f => funcionesPropias(E.ej, archivos[E.ej.alumno] ?? '').includes(f));
    estadoPasos[k] = !escrita ? undefined : ok === tests.length ? 'ok' : 'falla';
    if (!escrita) resumenVivo = '';
    dibujarPasos();
    // no se cambia de test solo (confunde): se queda en el que se está viendo; los puntos dicen cuáles pasan
    estadosVivo = escrita ? { paso: k, estados: res.map(r => r.estado) } : null;
  } else { resumenVivo = ''; estadosVivo = null; }
  pintarTestsVivo();
  dibujarVisual(false, 'cursor');
}

// Resultado de la comparación con lo esperado: lo que retornó (verde/rojo) y qué no coincide.
function htmlComparacion(cmp) {
  const rets = cmp.retornos.map(r => r.obtenido === r.esperado ? `<span class="ret ok">↩ ${esc(r.obtenido)}</span>`
    : `<span class="ret mal">↩ ${esc(r.obtenido)} <small>(se espera ${esc(r.esperado)})</small></span>`).join(' ');
  const nombres = MOD().nombresFallas;
  const todoBien = !cmp.fallas.length && cmp.retornos.every(r => r.obtenido === r.esperado);
  return `<div class="comparacion">${rets}${todoBien ? '<span class="res-bien">✓ como se espera</span>'
    : cmp.fallas.length ? `<span class="res-mal">✗ revisa: ${cmp.fallas.map(f => nombres[f]).join(', ')}</span>` : ''}</div>`;
}

// Explicación de un paso con error (la línea y qué puntero no se podía seguir).
function htmlDiagnostico(c, dentro) {
  const codigoLinea = dentro ? vis.lineasAlumno[c.linea - 1] : vis.lineasTest[c.linea - 1];
  let diag = MOD().diagnosticar(codigoLinea ?? '', c.estado, dentro ? c.fn.lista : E.ej.visual.variable);
  if (!diag && !dentro) {   // ¿la línea del test llama a una función tuya? el error pudo ser adentro
    const llamada = vis.fns.find(f => new RegExp(`\\b${f.nombre}\\s*\\(`).test(codigoLinea ?? ''));
    if (llamada) diag = `el error ocurrió dentro de tu <code>${esc(llamada.nombre)}</code>, llamada desde esta línea (revisa los punteros que sigue con <code>-></code>).`;
  }
  return `<p class="diagnostico">💥 En <code>${esc((codigoLinea ?? '').trim().replace(/;$/, ''))}</code>${diag ? ': ' + diag : '.'}</p>`;
}

// ---------- Paso a paso ----------
// vis.cuadros: los volcados en orden de ejecución (los del test y los de adentro de la función).
// vis.i: el cuadro que se muestra (-1 = antes de empezar). «Siguiente» avanza una línea del test
// (sin entrar a la función) o, si ya se está adentro, una línea de la función.
let vis = null;
// «Entrar siempre»: Siguiente entra a la función del estudiante en vez de pasarla de largo (se recuerda).
let entrarSiempre = true;
try { entrarSiempre = localStorage.getItem('ide-c:entrar') !== 'no'; } catch { /* sin almacenamiento */ }
const enTest = i => i < 0 || !vis.cuadros[i].dentro;
function proximoDelTest(i) { for (let k = i + 1; k < vis.cuadros.length; k++) if (!vis.cuadros[k].dentro) return k; return null; }
function finDeLlamada(i) {
  const c = vis.cuadros[i];
  // el último cuadro de esta llamada (saltando las llamadas a otras funciones que hace adentro,
  // como enlarge → insertMap)
  let k = i;
  for (let j = i + 1; vis.cuadros[j]?.dentro; j++) {
    const x = vis.cuadros[j];
    if (x.fn === c.fn) { if (x.llamada === c.llamada) k = j; else break; }
  }
  return k;
}
function anteriorDelTest(i) { for (let k = i - 1; k >= 0; k--) if (!vis.cuadros[k].dentro) return k; return -1; }
const acciones = {
  inicio: () => -1,
  fin: () => vis.cuadros.length - 1,
  siguiente: i => enTest(i) && entrarSiempre && vis.cuadros[i + 1]?.dentro ? i + 1
    : enTest(i) ? proximoDelTest(i) ?? (vis.cuadros.length - 1 > i ? vis.cuadros.length - 1 : null) : i + 1 < vis.cuadros.length ? i + 1 : null,
  atras: i => i < 0 ? null : enTest(i) ? anteriorDelTest(i) : i - 1,
  entrar: i => enTest(i) && vis.cuadros[i + 1]?.dentro ? i + 1 : null,
  saltar: i => enTest(i) && vis.cuadros[i + 1]?.dentro ? proximoDelTest(i) : null,   // pasar la llamada sin entrar
  // salir: primero al final de la llamada actual (si la función se llama varias veces en la línea); luego al test
  salir: i => enTest(i) ? null : finDeLlamada(i) !== i ? finDeLlamada(i) : proximoDelTest(i) ?? vis.cuadros.length - 1,
};
function mover(accion) {
  if (!vis) return;
  const j = acciones[accion](vis.i);
  if (j === null || j === undefined || j === vis.i) return;
  vis.i = j; mostrarPaso();
}
function mostrarPaso() {
  const { cuadros, i } = vis, c = cuadros[i], dentro = c && c.dentro;
  const numerar = (lineas, desde, actual, archivo) => lineas.map((l, k) =>
    `<div class="lc${desde + k === actual ? (c?.error ? ' actual falla' : ' actual') : ''}"><span class="n">${archivo && desde + k === actual ? '▶' : ''}${desde + k}</span><code>${esc(l) || ' '}</code></div>`).join('');
  let codigo;
  if (dentro) {
    const ini = c.fn.cabecera, fin = c.fn.fin, llamadas = c.llamadas;
    codigo = `<h4>Dentro de tu <code>${esc(c.fn.nombre)}</code>${llamadas > 1 ? ` · llamada ${c.llamada} de ${llamadas}` : ''} <a class="ir" data-linea="${c.linea}" title="Ir a esta línea en la pestaña Código">${esc(E.ej.alumno)}:${c.linea} ✎</a></h4>`
      + `<div class="codigo-paso">${numerar(vis.lineasAlumno.slice(ini - 1, fin), ini, c.linea, true)}</div>`;
  } else {
    codigo = `<h4>Test: ${esc(vis.test.nombre)}</h4><div class="codigo-paso">${numerar(vis.lineasTest, 1, c ? c.linea : 0, false)}</div>`;
  }
  const quePaso = i < 0 ? 'Antes de empezar.' : c.error ? `💥 Falló la línea ${c.linea} ${dentro ? 'de ' + esc(E.ej.alumno) : 'del test'}.` : dentro
    ? (c.condicion ? `Al evaluar la condición de la línea ${c.linea} de ${esc(E.ej.alumno)}.`
      : c.linea === c.fn.cabecera ? `Al entrar a ${esc(c.fn.nombre)}.`
      : c.estado?.vars?.some(v => v.nombre === 'return') ? `Retorna (línea ${c.linea} de ${esc(E.ej.alumno)}).`
      : `Después de la línea ${c.linea} de ${esc(E.ej.alumno)}.`)
      + (finDeLlamada(i) === i ? (cuadros[i + 1]?.dentro ? ' La llamada terminó; Siguiente ▶ entra a la próxima.' : ' La llamada terminó.') : '')
    : c.condicion ? `Al evaluar la condición de la línea ${c.linea} del test.` : `Después de la línea ${c.linea} del test.`;
  const dibujo = i < 0 ? '<p class="nota">Toca Siguiente ▶ para ejecutar la primera línea' + (cuadros[0]?.dentro ? ', o ⤵ Entrar para verla por dentro' : '') + '.</p>'
    : null;
  const ultimo = i === cuadros.length - 1;
  // al final de un test declarativo: el estado obtenido marcado (verde = como se espera, rojo = no)
  let comparacion = null;
  if (ultimo && c && !c.error && !dentro && vis.test.salida) {
    comparacion = MOD().comparar(c.estado, vis.test.salida);
    const obtenidos = [...(vis.salidaFinal ?? '').matchAll(/^retorna: (.*)$/gm)].map(m => m[1].trim());
    comparacion.retornos = (vis.test.salida.retornos ?? []).map((r, k) => ({ esperado: r === null ? 'NULL' : String(r), obtenido: obtenidos[k] ?? '—' }));
  }
  const indices = dentro ? new Set([...vis.lineasAlumno.slice(c.fn.cabecera - 1, c.fn.fin).join('\n').matchAll(/\[\s*([A-Za-z_]\w*)\s*\]/g)].map(m => m[1])) : null;   // variables que se usan como índice
  const dibujoFinal = dibujo ?? MOD().svg(c.estado, dentro ? c.fn.lista : E.ej.visual.variable, { lugares: vis.lugares, marcas: comparacion?.marcas, indices });
  const proxFn = cuadros[i + 1]?.dentro ? cuadros[i + 1].fn.nombre : '';
  const salida = (i < 0 ? '' : ultimo ? vis.salidaFinal : c.salida).trim();
  const puede = a => { const j = acciones[a](i); return j !== null && j !== undefined && j !== i; };
  const proxEntra = puede('entrar');
  $('vis-cuadros').innerHTML = vis.aviso + `<div class="paso-barra">
      <button data-a="inicio" title="Al comienzo">⏮</button>
      <button data-a="atras" title="Paso anterior (←)">◀<span class="txt"> Atrás</span></button>
      <button data-a="siguiente" class="principal" title="Siguiente línea (→)"><span class="txt">Siguiente </span>▶</button>
      <button data-a="entrar" title="Ver por dentro la llamada de la siguiente línea (↓)"${proxEntra && !entrarSiempre ? '' : ' hidden'}>⤵<span class="txt"> Entrar en ${esc(proxFn)}</span></button>
      <button data-a="saltar" title="Ejecutar la siguiente línea sin entrar a ${esc(proxFn)}"${proxEntra && entrarSiempre ? '' : ' hidden'}>⤼<span class="txt"> Sin entrar</span></button>
      <button data-a="salir" title="Ir al final de esta llamada; otra vez: volver al test (↑)"${dentro ? '' : ' hidden'}>⤴<span class="txt">${dentro && finDeLlamada(i) !== i ? ' Terminar la llamada' : ' Volver al test'}</span></button>
      <button data-a="fin" title="Al final">⏭</button>
      <label class="entrar-siempre" title="Siguiente ▶ entra a tu función en vez de pasarla de largo"><input type="checkbox" id="entrar-siempre"${entrarSiempre ? ' checked' : ''}> entrar<span class="txt"> a mi función</span></label>
      <span class="paso-info">${quePaso}</span>
    </div>
    <div class="paso-cuerpo${dentro ? ' dentro' : ''}">
      <div class="paso-codigo">${codigo}</div>
      <div class="paso-dibujo">${dibujoFinal}${comparacion ? htmlComparacion(comparacion) : ''}${c && !c.error ? MOD().htmlVariables(c.estado) : ''}
        ${ultimo && vis.error ? `<p class="error-ej">${esc(vis.error)}</p>` : ''}
        ${c?.error ? htmlDiagnostico(c, dentro) : ''}
        ${vis.test.salida ? '<details class="salida-texto"><summary>salida en texto</summary>' : ''}<div class="salidas vis-salidas">
          <div><h4>Esperado</h4><pre class="vis-salida">${esc(vis.test.esperado)}</pre></div>
          <div><h4>${ultimo ? 'Obtenido' : 'Impreso hasta aquí'}${ultimo ? (mismaSalida(vis.test.esperado, salida) ? ' ✅' : ' ❌') : ''}</h4><pre class="vis-salida${ultimo && !mismaSalida(vis.test.esperado, salida) ? ' distinta' : ''}">${esc(salida) || '<span class="vacio">(nada)</span>'}</pre></div>
        </div>${vis.test.salida ? '</details>' : ''}
      </div>
    </div>`;
  const caja = $('vis-cuadros');
  caja.querySelectorAll('[data-a]').forEach(b => { b.disabled = !puede(b.dataset.a); b.onclick = () => mover(b.dataset.a); });
  caja.querySelectorAll('a[data-linea]').forEach(a => a.onclick = () => irACodigo(+a.dataset.linea));
  $('entrar-siempre').onchange = e => {
    entrarSiempre = e.target.checked;
    try { localStorage.setItem('ide-c:entrar', entrarSiempre ? 'si' : 'no'); } catch { /* sin almacenamiento */ }
    mostrarPaso();
  };
  // en el editor del centro se marca la línea de la función que se está ejecutando
  editor.marcarEjecucion(E.ej.alumno, dentro && ejecucionVisible() ? c.linea : null);
  // la ventana de ejecución sobre el editor (celular): el resultado, el paso y el dibujo
  const d = describirTest(vis.test);
  $('vivo-info').innerHTML = `${esc(vis.test.nombre)} · ${quePaso}`;
  // qué entra y qué se espera (escrita a mano en el ejercicio); si no cabe, al tocarla se ve completa
  $('vivo-desc').textContent = vis.test.descripcion ?? vis.test.nombre;
  $('vis-test-desc').innerHTML = htmlTest(vis.test);
  // celular: solo el dibujo; en la línea de definición de la función, también la salida esperada
  const esEntrada = c?.dentro && !c.condicion && !c.error && c.linea === c.fn?.cabecera;
  const sal = vis.test.salida;
  // en la entrada (la línea de definición, o si la función aún no está escrita): un solo dibujo, el de la
  // entrada, con lo que se espera al final anotado encima (→ 7, → gato, ↩); si no hay entrada (createMap),
  // la llamada y el dibujo de lo que debe quedar
  const sinEntradaHtml = () => `<div class="vivo-fila"><code class="llamada-vivo">${esc(d?.llamadas ?? '')}</code><span class="flecha-vivo">→</span>${MOD().svg(MOD().estadoSalida(vis.test), E.ej.visual.variable, { sinDirecciones: true })}</div>`;
  if (vis.sinEscribir && sal) {   // la función del paso aún no está escrita
    const ent = MOD().estadoEntrada(vis.test);
    $('vivo-zoom').innerHTML = !ent ? sinEntradaHtml() : `<div class="vivo-fila">${MOD().anotado(ent, sal, E.ej.visual.variable, { sinDirecciones: true })}</div>`;
    $('vivo').classList.remove('pasa', 'falla');
    $('vivo-nota').innerHTML = '';
    pintarTestsVivo();
    mostrarVivo();
    return;
  }
  if (esEntrada && sal) {
    $('vivo-zoom').innerHTML = MOD().vacio(c.estado) ? sinEntradaHtml()
      : `<div class="vivo-fila">${MOD().anotado(c.estado, sal, c.fn.lista, { lugares: vis.lugares })}</div>`;
  } else $('vivo-zoom').innerHTML = `<div class="vivo-fila">${dibujoFinal}</div>`;
  $('vivo').classList.toggle('pasa', !!vis.pasa);
  $('vivo').classList.toggle('falla', !vis.pasa);
  // bajo el dibujo: por qué se cayó (la línea y el puntero), o el error de ejecución al final
  $('vivo-nota').innerHTML = c?.error ? htmlDiagnostico(c, dentro) : ultimo && vis.error ? `<p class="error-ej">${esc(vis.error)}</p>` : '';
  pintarTestsVivo();
  mostrarVivo();
}
document.addEventListener('keydown', e => {
  if ($('vis-panel').hidden || !vis || /^(SELECT|INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); pasoVivo(e.key === 'ArrowRight' ? 1 : -1); return; }   // como ◀ ▶
  const a = { Home: 'inicio', End: 'fin' }[e.key];
  if (a) { e.preventDefault(); mover(a); }
});

// Lleva el editor a esa línea del archivo del estudiante.
function irACodigo(linea) {
  irPestana('centro');
  editor.abrir(E.ej.alumno, linea);
}
const mensajesDe = r => r.compilado ? mensajesCompilador(r.compilado.mensajes) : [{ archivo: null, linea: null, texto: 'El compilador no respondió.' }];

$('probar-paso').onclick = () => probar(false);
$('probar-todo').onclick = () => probar(true);
$('verificar-curso').onclick = () => probar('curso');
$('detener').onclick = () => runner.detener?.();
$('restaurar').onclick = () => {
  if (!confirm('¿Volver a los archivos originales? Se pierde lo que escribiste en este ejercicio.')) return;
  borrarGuardado(E.ej);
  abrirEjercicio(E.ej.id);
};
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); probar(e.shiftKey); }
});

// Modo profesor: pide la contraseña (se recuerda mientras la pestaña esté abierta) y descifra
// la solución. Sin la contraseña correcta, vuelve al modo normal.
async function pedirSolucion(ej) {
  let clave = null;
  try { clave = sessionStorage.getItem('ide-c:clave-profesor'); } catch { /* sin almacenamiento */ }
  for (let intento = 0; ; intento++) {
    if (!clave) clave = await pedirClave(intento > 0);
    if (!clave) { location.search = ''; throw new Error('modo profesor cancelado'); }
    try {
      const sol = await cargarSolucion(ej, clave);
      try { sessionStorage.setItem('ide-c:clave-profesor', clave); } catch { /* sin almacenamiento */ }
      return sol;
    } catch (e) {
      if (!/contraseña/.test(e.message)) throw e;
      clave = null;
    }
  }
}

// Cuadro para escribir la contraseña (en la página, no una ventana del navegador).
function pedirClave(error) {
  const d = $('dialogo-clave');
  $('clave-error').hidden = !error;
  $('clave-profesor').value = '';
  return new Promise(listo => {
    d.onclose = () => listo(d.returnValue === 'ok' ? $('clave-profesor').value : null);
    d.showModal();
    $('clave-profesor').focus();
  });
}

// ---------- Pestañas del celular ----------
// En pantallas angostas se ve una sección a la vez: Función, Código o Tests.
function irPestana(p) {
  $('codigo').dataset.movil = p;
  document.querySelectorAll('#pestanas-movil button').forEach(b => b.classList.toggle('activa', b.dataset.p === p));
  try { localStorage.setItem('ide-c:pestana', p); } catch { /* sin almacenamiento */ }
  if (p === 'centro') setTimeout(() => editor.refrescar(), 0);
}
document.querySelectorAll('#pestanas-movil button').forEach(b => b.onclick = () => irPestana(b.dataset.p));
let pestanaInicial = 'pasos';
try { pestanaInicial = localStorage.getItem('ide-c:pestana') || 'pasos'; } catch { /* sin almacenamiento */ }
if (!['pasos', 'centro'].includes(pestanaInicial)) pestanaInicial = 'centro';   // ya no hay pestaña de ejecución: está en la ventana
irPestana(pestanaInicial);

// ---------- Inicio ----------

$('modo-profesor').hidden = !MODO_PROFESOR;
if (MODO_PROFESOR) document.title += ' · Profesor';

const lista = await listaEjercicios();
$('ejercicio').innerHTML = lista.map(e => `<option value="${esc(e.id)}">${esc(e.titulo)}</option>`).join('');
$('ejercicio').onchange = () => abrirEjercicio($('ejercicio').value);
let ejInicial = new URLSearchParams(location.search).get('ej');
try { ejInicial ??= localStorage.getItem('ide-c:ej'); } catch { /* sin almacenamiento */ }
await abrirEjercicio(lista.some(e => e.id === ejInicial) ? ejInicial : lista[0].id);

// ---------- Actualización ----------
// El celular puede guardar la página vieja en caché. version.txt (lo escribe herramientas/version.mjs) dice
// cuál es la versión publicada; si no es la que está corriendo, se recarga con la nueva (lo escrito por el
// estudiante queda guardado en el navegador). Se revisa al abrir y cada vez que se vuelve a la pestaña.
const VERSION = new URL(import.meta.url).searchParams.get('v');
async function revisarVersion() {
  if (!VERSION || location.protocol === 'file:') return;
  let publicada;
  try { publicada = (await (await fetch(`version.txt?t=${Date.now()}`, { cache: 'no-store' })).text()).trim(); } catch { return; }
  if (!/^\d+$/.test(publicada) || publicada === VERSION) return;
  try { if (sessionStorage.getItem('ide-c:recargada') === publicada) return; sessionStorage.setItem('ide-c:recargada', publicada); } catch { /* sin almacenamiento */ }
  estado('Hay una versión nueva: actualizando…');
  const u = new URL(location.href);
  u.searchParams.set('v', publicada);
  location.replace(u.toString());
}
revisarVersion();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') revisarVersion(); });

// La descripción del test: si no cabe, al tocarla se ve completa (y otra vez, en una línea)
$('vivo-desc').onclick = () => $('vivo-desc').classList.toggle('completa');
