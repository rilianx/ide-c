// IDE C: arranque, ejercicios, pasos, ▶ Play y tests.
import { Editor } from './editor.js?v=202611181318';
import { Runner } from './runner.js?v=202611181318';
import { listaEjercicios, cargarEjercicio, archivosGuardados, guardar, borrarGuardado } from './ejercicios.js?v=202611181318';
import { svgLista } from './visual.js?v=202611181318';
import { agregarPlantilla, funcionesDefinidas, funcionesPropias, armarVisual, leerVolcados, mensajes as mensajesCompilador } from './proyecto.js?v=202611181318';
import { Asistente } from './asistente.js?v=202611181318';
import { activarDivisores } from './divisores.js?v=202611181318';
import { correrTests, htmlResultados } from './tests.js?v=202611181318';

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
  $('vis-nota').textContent = 'Corre el test con tu ' + E.ej.alumno + ' y dibuja la memoria después de cada línea.';
  if (visPaso !== paso) { visPaso = paso; $('vis-test').value = `${paso}.0`; $('vis-cuadros').innerHTML = ''; if (dibujar) dibujarVisual(); }
  else $('vis-test').value = visElegido ?? `${paso}.0`;
}
let visElegido = null;
$('vis-test').onchange = () => dibujarVisual();
$('vis-dibujar').onclick = () => dibujarVisual();

async function dibujarVisual() {
  if (ocupado) return;
  visElegido = $('vis-test').value;
  const [k, i] = visElegido.split('.').map(Number);
  const test = E.ej.pasos[k].tests[i];
  const lineas = test.codigo.split('\n');
  ocupar(true);
  estado('Dibujando…');
  const caja = $('vis-cuadros');
  try {
    const r = await runner.ejecutar(armarVisual(E.ej, archivos, E.ocultos, test));
    if (!r.compilado?.ok) {
      caja.innerHTML = '<div class="cuadro"></div>';
      mostrarCompilacion(caja.firstChild, mensajesDe(r), false);
      estado('No compila.', true);
    } else {
      const d = r.llamadas.get(0) ?? {};
      const { salida, cuadros } = leerVolcados(d.stdout);
      // un dibujo por cambio en la memoria; las líneas que no la cambian se juntan con el anterior
      const grupos = [];
      for (const c of cuadros) {
        const clave = JSON.stringify(c.estado), g = grupos.at(-1);
        if (g && g.clave === clave) g.lineas.push({ n: c.linea, igual: true });
        else grupos.push({ clave, estado: c.estado, lineas: [{ n: c.linea, igual: false }] });
      }
      const linea = (l, i) => `<div class="cuadro-linea${l.igual ? ' sin-cambio' : ''}"><span class="num">línea ${l.n}</span><code>${esc(lineas[l.n - 1].trim())}</code>${l.igual ? '<span class="nota">(no cambia la memoria)</span>' : ''}</div>`;
      const nombre = E.ej.visual.variable;
      caja.innerHTML = grupos.map(g => `<div class="cuadro">${g.lineas.map(linea).join('')}${svgLista(g.estado, nombre)}</div>`).join('')
        + (d.error || !d.ok ? `<p class="error-ej">${esc(traducir(d.error ?? d.stderr ?? 'No se pudo ejecutar'))}${cuadros.length ? ` (después de la línea ${cuadros.at(-1).linea})` : ''}</p>` : '')
        + (salida.trim() ? `<h4>Lo que imprimió el test</h4><pre class="vis-salida">${esc(salida.trim())}</pre>` : '');
      estado(d.error || !d.ok ? 'El test se detuvo con un error.' : `Listo: ${grupos.length} dibujo${grupos.length === 1 ? '' : 's'}.`, !!(d.error || !d.ok));
    }
  } catch (e) {
    estado('No se pudo dibujar: ' + e.message, true);
  }
  ocupar(false);
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
