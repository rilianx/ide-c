// IDE C: arranque, ejercicios, pasos, ▶ Play y tests.
import { Editor } from './editor.js';
import { Runner } from './runner.js';
import { listaEjercicios, cargarEjercicio, archivosGuardados, guardar, borrarGuardado } from './ejercicios.js';
import { agregarPlantilla, funcionesDefinidas } from './proyecto.js';
import { Asistente } from './asistente.js';
import { activarDivisores } from './divisores.js';
import { correrTests, htmlResultados } from './tests.js';

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

const editor = new Editor($('editor'), $('pestanas'), {
  alCambiar: (nombre, texto) => {
    archivos[nombre] = texto;
    guardar(E.ej, archivos);
    if (nombre === E.ej.alumno) dibujarFunciones();
  },
});
const asistente = new Asistente($('asistente'), editor, () => ({ ej: E.ej, archivos }));
activarDivisores(document.getElementById('codigo'), () => editor.refrescar());

function estado(texto, error = false) {
  $('estado').textContent = texto;
  $('estado').style.color = error ? 'var(--mal)' : '';
}

function ocupar(si) {
  ocupado = si;
  for (const id of ['probar-paso', 'probar-todo']) $(id).disabled = si;
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
  dibujarFunciones();
  asistente.dibujar();
}

function dibujarPasos() {
  const ol = $('lista-pasos'); ol.innerHTML = '';
  E.ej.pasos.forEach((p, k) => {
    const li = document.createElement('li'), b = document.createElement('button');
    b.className = k === paso ? 'activo' : '';
    b.innerHTML = `<span>${esc(p.titulo)}</span><span>${estadoPasos[k] === 'ok' ? '✅' : estadoPasos[k] === 'falla' ? '❌' : ''}</span>`;
    b.onclick = () => elegirPaso(k);
    li.appendChild(b); ol.appendChild(li);
  });
}

function elegirPaso(k, conFoco = true) {
  paso = k;
  const p = E.ej.pasos[k];
  const faltan = p.funciones.filter(f => !funcionesDefinidas(archivos[E.ej.alumno], [f]).length);
  $('enunciado').innerHTML = md(p.enunciado) + (faltan.length
    ? `<button id="escribir">✎ Escribir ${faltan.map(f => `<code>${f}</code>`).join(' y ')} en ${E.ej.alumno}</button>`
    : `<p class="descripcion">Ya está en ${E.ej.alumno}: ✓ Probar paso para revisarla.</p>`);
  if (faltan.length) $('escribir').onclick = () => {
    editor.abrir(E.ej.alumno);
    editor.poner(E.ej.alumno, agregarPlantilla(editor.texto(E.ej.alumno), p));
    asistente.irAFuncion(faltan[0]);
    elegirPaso(k, false);
  };
  dibujarPasos();
  if (conFoco && !faltan.length) asistente.irAFuncion(p.funciones[0]);
}

// Qué funciones escribió el estudiante y cuáles usan la versión del curso.
function dibujarFunciones() {
  const propias = new Set(funcionesDefinidas(archivos[E.ej.alumno] ?? '', E.ej.funciones));
  $('funciones').innerHTML = E.ej.funciones.map(f =>
    `<li><code>${f}</code><span class="${propias.has(f) ? 'tuya">tuya' : 'curso">del curso'}</span></li>`).join('');
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

async function probar(todos) {
  if (ocupado) return;
  ocupar(true);
  const pasos = todos ? E.ej.pasos.map((p, k) => k) : [paso];
  const tests = pasos.flatMap(k => E.ej.pasos[k].tests.map(t => ({ ...t, paso: k })));
  $('compilacion-tests').innerHTML = '';
  estado('Compilando y probando…');
  const dibujar = res => {
    $('resultados').innerHTML = htmlResultados(tests, res.map(r => ({ ...r, error: r.error && traducir(r.error) })));
    const ok = res.filter(r => r.estado === 'ok').length;
    $('resumen-tests').textContent = `${ok}/${tests.length}`;
  };
  try {
    const { compilacion, resultados } = await correrTests(runner, E.ej, archivos, E.ocultos, tests, dibujar);
    const compilo = !resultados.some(r => r.estado === 'sin-compilar');
    mostrarCompilacion($('compilacion-tests'), compilacion, compilo);
    for (const k of pasos) {
      const delPaso = resultados.filter((r, i) => tests[i].paso === k);
      estadoPasos[k] = delPaso.every(r => r.estado === 'ok') ? 'ok' : 'falla';
    }
    dibujarPasos();
    const ok = resultados.filter(r => r.estado === 'ok').length;
    estado(compilo ? `${ok} de ${tests.length} tests pasan.` : 'No compila.', !compilo || ok < tests.length);
  } catch (e) {
    estado('No se pudo probar: ' + e.message, true);
    $('resultados').innerHTML = htmlResultados(tests, tests.map(() => ({ estado: 'sin-compilar', obtenido: '', error: null })));
  }
  ocupar(false);
}

// ---------- Paneles, vistas y botones ----------

document.querySelectorAll('.vista').forEach(b => b.onclick = () => {
  document.querySelectorAll('.vista').forEach(x => x.classList.toggle('activa', x === b));
  $('codigo').hidden = b.dataset.vista !== 'codigo';
  $('visual').hidden = b.dataset.vista !== 'visual';
  editor.refrescar();
});

$('probar-paso').onclick = () => probar(false);
$('probar-todo').onclick = () => probar(true);
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
