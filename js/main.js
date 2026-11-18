// IDE C: arranque, ejercicios, pasos, ▶ Play y tests.
import { Editor } from './editor.js?v=202611181335';
import { Runner } from './runner.js?v=202611181335';
import { listaEjercicios, cargarEjercicio, archivosGuardados, guardar, borrarGuardado } from './ejercicios.js?v=202611181335';
import { svgLista } from './visual.js?v=202611181335';
import { agregarPlantilla, funcionesDefinidas, funcionesPropias, funcionesDelArchivo, armarVisual, leerVolcados, mensajes as mensajesCompilador } from './proyecto.js?v=202611181335';
import { Asistente } from './asistente.js?v=202611181335';
import { activarDivisores } from './divisores.js?v=202611181335';
import { correrTests, htmlResultados } from './tests.js?v=202611181335';

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

let tSelector = null;
const editor = new Editor($('editor'), $('pestanas'), {
  alCambiar: (nombre, texto) => {
    archivos[nombre] = texto;
    guardar(E.ej, archivos);
    if (nombre === E.ej.alumno) { clearTimeout(tSelector); tSelector = setTimeout(dibujarPasos, 300); }
  },
});
const asistente = new Asistente($('asistente'), editor, () => ({ ej: E.ej, archivos }), {
  // al entrar a una función con el cursor, se elige su paso
  alCambiarFuncion: f => { const k = E.ej.pasos.findIndex(p => p.funciones.includes(f)); if (k >= 0 && k !== paso) elegirPaso(k, false); else dibujarPasos(); },
});
activarDivisores(document.getElementById('codigo'), () => editor.refrescar());

// Letra y ajuste de líneas (se recuerdan en el navegador). En pantallas angostas, ajuste activado.
const pref = { letra: 14, ajustar: innerWidth < 1000 };
try { Object.assign(pref, JSON.parse(localStorage.getItem('ide-c:vista') || '{}')); } catch { /* sin almacenamiento */ }
function aplicarVista() {
  pref.letra = Math.min(24, Math.max(10, pref.letra));
  editor.letra(pref.letra);
  editor.ajustar(pref.ajustar);
  $('ajustar').classList.toggle('activo', pref.ajustar);
  try { localStorage.setItem('ide-c:vista', JSON.stringify(pref)); } catch { /* sin almacenamiento */ }
}
$('letra-menos').onclick = () => { pref.letra--; aplicarVista(); };
$('letra-mas').onclick = () => { pref.letra++; aplicarVista(); };
$('ajustar').onclick = () => { pref.ajustar = !pref.ajustar; aplicarVista(); };
aplicarVista();

function estado(texto, error = false) {
  $('estado').textContent = texto;
  $('estado').style.color = error ? 'var(--mal)' : '';
}

function ocupar(si) {
  ocupado = si;
  for (const id of ['probar-paso', 'probar-todo', 'verificar-curso', 'vis-dibujar']) $(id).disabled = si;
  $('detener').hidden = !si;
}

// ---------- Ejercicio, pasos y funciones ----------

async function abrirEjercicio(id) {
  E = await cargarEjercicio(id);
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
  const f = $('funcion').value, k = E.ej.pasos.findIndex(p => p.funciones.includes(f));
  if (k >= 0) elegirPaso(k, true, f);
};

function elegirPaso(k, conFoco = true, fn = null) {
  paso = k;
  const p = E.ej.pasos[k];
  const faltan = p.funciones.filter(f => !funcionesDefinidas(archivos[E.ej.alumno], [f]).length);
  $('enunciado').innerHTML = md(p.enunciado) + (faltan.length
    ? `<button id="escribir">✎ Escribir ${faltan.map(f => `<code>${f}</code>`).join(' y ')} en ${E.ej.alumno}</button>`
    : `<p class="descripcion">Ya está en ${E.ej.alumno}: ▶ Probar actual para revisarla.</p>`);
  if (faltan.length) $('escribir').onclick = () => {
    editor.abrir(E.ej.alumno);
    editor.poner(E.ej.alumno, agregarPlantilla(editor.texto(E.ej.alumno), p));
    asistente.irAFuncion(faltan[0]);
    elegirPaso(k, false);
  };
  dibujarPasos();
  if (conFoco) { asistente.irAFuncion(fn ?? p.funciones[0]); if (faltan.length) elegirPaso(k, false); }
}

// ---------- Mensajes del compilador ----------

function htmlCompilacion(lista, titulo, avisos = false) {
  if (!lista?.length) return '';
  const visibles = new Set(E.ej.archivos.map(a => a.nombre));
  const lineas = lista.map(m => {
    const donde = m.archivo && visibles.has(m.archivo)
      ? `<a data-archivo="${esc(m.archivo)}" data-linea="${m.linea}">${esc(m.archivo)}:${m.linea}</a>: ` : '';
    return `<div>${donde}${esc(m.texto)}</div>`;
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
  const tests = pasos.flatMap(k => E.ej.pasos[k].tests.map(t => ({ ...t, paso: k })));
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

document.querySelectorAll('.vista').forEach(b => b.onclick = () => {
  document.querySelectorAll('.vista').forEach(x => x.classList.toggle('activa', x === b));
  $('codigo').hidden = b.dataset.vista !== 'codigo';
  $('visual').hidden = b.dataset.vista !== 'visual';
  editor.refrescar();
  if (!$('visual').hidden) prepararVisual(true);
});

// ---------- Visualización ----------

// Selector con todos los tests, agrupados por función; al abrir la pestaña se elige
// el primer test de la función actual (si cambió) y se dibuja.
let visPaso = null;
function prepararVisual(dibujar = false) {
  if (!E.ej.visual) { $('vis-cuadros').innerHTML = '<p class="pronto">Este ejercicio aún no tiene visualización.</p>'; return; }
  $('vis-test').innerHTML = E.ej.pasos.map((p, k) => `<optgroup label="${esc(p.titulo)}">`
    + p.tests.map((t, i) => `<option value="${k}.${i}">${esc(t.nombre)}</option>`).join('') + '</optgroup>').join('');
  $('vis-nota').textContent = 'Ejecuta el test con tu ' + E.ej.alumno + ' paso a paso: Siguiente avanza una línea y Entrar muestra tu función por dentro.';
  if (visPaso !== paso) { visPaso = paso; visElegido = `${paso}.0`; }
  $('vis-test').value = visElegido ?? `${paso}.0`;
  if (dibujar) dibujarVisual(true);   // solo si cambió el test o el código
}
let visElegido = null;
$('vis-test').onchange = () => dibujarVisual();
$('vis-dibujar').onclick = () => dibujarVisual();

// Dibuja el test elegido. Si la función del paso es del estudiante, también se ve por dentro
// (línea a línea en su archivo, con sus variables) en cada línea del test que la llama.
let visDibujado = null;   // {test, codigo}: para no volver a dibujar si nada cambió
async function dibujarVisual(soloSiCambio = false) {
  if (ocupado) return;
  visElegido = $('vis-test').value;
  const [k, i] = visElegido.split('.').map(Number);
  const test = E.ej.pasos[k].tests[i];
  const codigoAlumno = archivos[E.ej.alumno] ?? '';
  if (soloSiCambio && visDibujado?.test === visElegido && visDibujado.codigo === codigoAlumno) return;
  const lineasTest = test.codigo.split('\n'), lineasAlumno = codigoAlumno.split('\n');
  const propias = new Set(funcionesPropias(E.ej, codigoAlumno));
  const detalle = E.ej.pasos[k].funciones.find(f => propias.has(f)) ?? null;   // la función del test elegido
  const fnInfo = detalle ? funcionesDelArchivo(codigoAlumno).find(f => f.nombre === detalle) : null;
  const lineaCabecera = fnInfo ? codigoAlumno.slice(0, fnInfo.cuerpo).split('\n').length : null;
  const nombreListaFn = fnInfo ? (fnInfo.params.find(q => q.base === E.ej.visual.tipo && q.ptr === 1)?.nombre
    ?? new RegExp(`\\b${E.ej.visual.tipo}\\s*\\*\\s*(\\w+)`).exec(codigoAlumno.slice(fnInfo.cuerpo, fnInfo.fin))?.[1] ?? 'list') : null;
  ocupar(true);
  estado('Dibujando…');
  const caja = $('vis-cuadros');
  try {
    let r = await runner.ejecutar(armarVisual(E.ej, archivos, E.ocultos, test, detalle));
    let sinDetalle = false;
    if (detalle && !r.compilado?.ok) {   // si no compila con el detalle, se intenta sin él
      const r2 = await runner.ejecutar(armarVisual(E.ej, archivos, E.ocultos, test, null));
      if (r2.compilado?.ok) { r = r2; sinDetalle = true; }
    }
    if (!r.compilado?.ok) {
      caja.innerHTML = '<div class="cuadro"></div>';
      mostrarCompilacion(caja.firstChild, mensajesDe(r), false);
      estado('No compila.', true);
    } else {
      const d = r.llamadas.get(0) ?? {};
      const { salida, cuadros } = leerVolcados(d.stdout);
      const aviso = !detalle ? `<p class="nota">Tu <code>${esc(E.ej.pasos[k].funciones.join(', '))}</code> aún no está escrita: el test usa la del curso y no se puede entrar a ella.</p>`
        : sinDetalle ? `<p class="nota">No se pudo preparar la vista por dentro de <code>${esc(detalle)}</code> (hay una línea que no supe instrumentar); se muestra solo el test.</p>` : '';
      // numera las llamadas a la función (cada una empieza en la línea de la cabecera)
      let llamada = 0;
      for (const c of cuadros) if (c.dentro) { if (c.linea === lineaCabecera) llamada++; c.llamada = Math.max(llamada, 1); }
      const lineaFin = fnInfo ? codigoAlumno.slice(0, fnInfo.fin).split('\n').length : null;
      vis = { cuadros, i: -1, test, lineasTest, lineasAlumno, fnInfo, detalle, lineaCabecera, lineaFin, nombreListaFn, aviso,
        error: d.error || !d.ok ? traducir(d.error ?? d.stderr ?? 'No se pudo ejecutar') : null };
      vis.salidaFinal = salida;
      mostrarPaso();
      visDibujado = { test: visElegido, codigo: codigoAlumno };
      estado(d.error || !d.ok ? 'El test se detuvo con un error (avanza hasta el final para verlo).' : 'Listo: avanza con Siguiente ▶ o con las flechas del teclado.', !!(d.error || !d.ok));
    }
  } catch (e) {
    estado('No se pudo dibujar: ' + e.message, true);
  }
  ocupar(false);
}

// ---------- Paso a paso ----------
// vis.cuadros: los volcados en orden de ejecución (los del test y los de adentro de la función).
// vis.i: el cuadro que se muestra (-1 = antes de empezar). «Siguiente» avanza una línea del test
// (sin entrar a la función) o, si ya se está adentro, una línea de la función.
let vis = null;
const enTest = i => i < 0 || !vis.cuadros[i].dentro;
function proximoDelTest(i) { for (let k = i + 1; k < vis.cuadros.length; k++) if (!vis.cuadros[k].dentro) return k; return null; }
function finDeLlamada(i) { let k = i; while (vis.cuadros[k + 1]?.dentro && vis.cuadros[k + 1].llamada === vis.cuadros[i].llamada) k++; return k; }
function anteriorDelTest(i) { for (let k = i - 1; k >= 0; k--) if (!vis.cuadros[k].dentro) return k; return -1; }
const acciones = {
  inicio: () => -1,
  fin: () => vis.cuadros.length - 1,
  siguiente: i => enTest(i) ? proximoDelTest(i) ?? (vis.cuadros.length - 1 > i ? vis.cuadros.length - 1 : null) : i + 1 < vis.cuadros.length ? i + 1 : null,
  atras: i => i < 0 ? null : enTest(i) ? anteriorDelTest(i) : i - 1,
  entrar: i => enTest(i) && vis.cuadros[i + 1]?.dentro ? i + 1 : null,
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
    `<div class="lc${desde + k === actual ? ' actual' : ''}"><span class="n">${archivo && desde + k === actual ? '▶' : ''}${desde + k}</span><code>${esc(l) || ' '}</code></div>`).join('');
  let codigo;
  if (dentro) {
    const ini = vis.lineaCabecera, fin = vis.lineaFin;
    const llamadas = Math.max(...cuadros.filter(x => x.dentro).map(x => x.llamada));
    codigo = `<h4>Dentro de tu <code>${esc(vis.detalle)}</code>${llamadas > 1 ? ` · llamada ${c.llamada} de ${llamadas}` : ''} <a class="ir" data-linea="${c.linea}" title="Ir a esta línea en la pestaña Código">${esc(E.ej.alumno)}:${c.linea} ✎</a></h4>`
      + `<div class="codigo-paso">${numerar(vis.lineasAlumno.slice(ini - 1, fin), ini, c.linea, true)}</div>`;
  } else {
    codigo = `<h4>Test: ${esc(vis.test.nombre)}</h4><div class="codigo-paso">${numerar(vis.lineasTest, 1, c ? c.linea : 0, false)}</div>`;
  }
  const quePaso = i < 0 ? 'Antes de empezar.' : dentro
    ? (c.linea === vis.lineaCabecera ? `Al entrar a ${esc(vis.detalle)}.` : `Después de la línea ${c.linea} de ${esc(E.ej.alumno)}.`)
      + (finDeLlamada(i) === i ? (cuadros[i + 1]?.dentro ? ' La llamada terminó; Siguiente ▶ entra a la próxima.' : ' La llamada terminó.') : '')
    : `Después de la línea ${c.linea} del test.`;
  const dibujo = i < 0 ? '<p class="nota">Toca Siguiente ▶ para ejecutar la primera línea' + (cuadros[0]?.dentro ? ', o ⤵ Entrar para verla por dentro' : '') + '.</p>'
    : svgLista(c.estado, dentro ? vis.nombreListaFn : E.ej.visual.variable);
  const ultimo = i === cuadros.length - 1;
  const salida = (i < 0 ? '' : ultimo ? vis.salidaFinal : c.salida).trim();
  const puede = a => { const j = acciones[a](i); return j !== null && j !== undefined && j !== i; };
  const proxEntra = puede('entrar');
  $('vis-cuadros').innerHTML = vis.aviso + `<div class="paso-barra">
      <button data-a="inicio" title="Al comienzo">⏮</button>
      <button data-a="atras" title="Paso anterior (←)">◀ Atrás</button>
      <button data-a="siguiente" class="principal" title="Siguiente línea (→)">Siguiente ▶</button>
      <button data-a="entrar" title="Ver por dentro la llamada de la siguiente línea (↓)"${proxEntra ? '' : ' hidden'}>⤵ Entrar en ${esc(vis.detalle ?? '')}</button>
      <button data-a="salir" title="Ir al final de esta llamada; otra vez: volver al test (↑)"${dentro ? '' : ' hidden'}>${dentro && finDeLlamada(i) !== i ? '⤴ Terminar la llamada' : '⤴ Volver al test'}</button>
      <button data-a="fin" title="Al final">⏭</button>
      <span class="paso-info">${quePaso}</span>
    </div>
    <div class="paso-cuerpo${dentro ? ' dentro' : ''}">
      <div class="paso-codigo">${codigo}</div>
      <div class="paso-dibujo">${dibujo}
        ${ultimo && vis.error ? `<p class="error-ej">${esc(vis.error)}</p>` : ''}
        ${salida ? `<h4>${ultimo ? 'Lo que imprimió el test' : 'Lo que imprimió hasta aquí'}</h4><pre class="vis-salida">${esc(salida)}</pre>` : ''}
      </div>
    </div>`;
  const caja = $('vis-cuadros');
  caja.querySelectorAll('[data-a]').forEach(b => { b.disabled = !puede(b.dataset.a); b.onclick = () => mover(b.dataset.a); });
  caja.querySelectorAll('a[data-linea]').forEach(a => a.onclick = () => irACodigo(+a.dataset.linea));
}
document.addEventListener('keydown', e => {
  if ($('visual').hidden || !vis || /^(SELECT|INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)) return;
  const a = { ArrowRight: 'siguiente', ArrowLeft: 'atras', ArrowDown: 'entrar', ArrowUp: 'salir', Home: 'inicio', End: 'fin' }[e.key];
  if (a) { e.preventDefault(); mover(a); }
});

// Vuelve a la pestaña Código, en esa línea del archivo del estudiante.
function irACodigo(linea) {
  document.querySelector('.vista[data-vista=codigo]').click();
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

// ---------- Inicio ----------

const lista = await listaEjercicios();
$('ejercicio').innerHTML = lista.map(e => `<option value="${esc(e.id)}">${esc(e.titulo)}</option>`).join('');
$('ejercicio').onchange = () => abrirEjercicio($('ejercicio').value);
await abrirEjercicio(new URLSearchParams(location.search).get('ej') ?? lista[0].id);
