// Tests: cada uno es un trozo de C que usa solo la interfaz (.h) e imprime algo;
// se compara su salida con la esperada. Si un test se cuelga (ciclo infinito),
// se detiene y se siguen corriendo los que faltan.
import { svgLista, estadoDeLista } from './visual.js?v=202611182132';
import { armarTests, mismaSalida, mensajes, describirTest } from './proyecto.js?v=202611182132';

// tests: [{nombre, codigo, esperado, paso}]; alActualizar(resultados) se llama a medida que avanzan.
// Devuelve {compilacion, resultados} con resultados[i] = {estado, obtenido, error}.
export async function correrTests(runner, ej, archivos, ocultos, tests, alActualizar = () => {}) {
  const resultados = tests.map(() => ({ estado: 'pendiente', obtenido: '', error: null }));
  alActualizar(resultados);
  let compilacion = null;
  let faltan = tests.map((t, i) => i);
  let revision = true;   // con la revisión de punteros (si no compila así, se intenta sin ella)
  while (faltan.length) {
    const prog = armarTests(ej, archivos, ocultos, faltan.map(i => tests[i]), revision);
    const r = await runner.ejecutar(prog, {
      llamada: d => {
        const i = faltan[d.id], t = tests[i];
        // la revisión de punteros deja «@@FALLA línea tipo» en la salida y detiene el test
        const fa = /@@FALLA (\d+) (\w+)\n?/.exec(d.stdout ?? '');
        const stdout = fa ? d.stdout.slice(0, fa.index) : d.stdout;
        const motivo = fa && { NULL: 'se siguió un puntero NULL (->)', BASURA: 'se siguió un puntero con basura (->)' }[fa[2]];
        resultados[i] = fa
          ? { estado: 'error', obtenido: stdout, error: `Error de ejecución en ${ej.alumno}:${fa[1]}: ${motivo}. Usa 👁 Ver para ver la memoria en ese momento.` }
          : {
            estado: d.error ? 'error' : !d.ok ? 'error' : mismaSalida(t.esperado, stdout) ? 'ok' : 'falla',
            obtenido: stdout, error: d.error ?? (d.ok ? null : d.stderr.trim() || 'No se pudo ejecutar'),
          };
        alActualizar(resultados);
      },
    });
    if (revision && r.compilado && !r.compilado.ok) { revision = false; continue; }   // se reintenta sin la revisión
    if (!r.compilado || !r.compilado.ok) {   // no compila: ningún test corre
      compilacion = r.compilado ? mensajes(r.compilado.mensajes) : [{ archivo: null, linea: null, texto: 'El compilador no respondió.' }];
      for (const i of faltan) if (resultados[i].estado === 'pendiente') resultados[i] = { estado: 'sin-compilar', obtenido: '', error: null };
      alActualizar(resultados);
      break;
    }
    if (r.compilado.mensajes?.trim()) compilacion = mensajes(r.compilado.mensajes);   // advertencias
    faltan = faltan.filter(i => resultados[i].estado === 'pendiente');
    if (!r.detenido) break;
  }
  return { compilacion, resultados };
}

// El test: entrada, llamadas y salida esperada (o su código, si es un test escrito en C).
export function htmlTest(t, variable = 'L') {
  const d = describirTest(t);
  if (!d) return `<pre class="codigo-test">${esc(t.codigo)}</pre>`;
  const e = t.entrada ?? {}, s = t.salida ?? {};
  const entrada = e.lista === null || e.lista === undefined ? '<span class="nota">(sin lista)</span>'
    : svgLista(estadoDeLista(e.lista, Number.isInteger(e.current) ? e.current : null), variable, { sinDirecciones: true, escala: 0.42, porFila: 5 });
  const salida = svgLista(estadoDeLista(s.lista, 'current' in s ? s.current : undefined, true), variable, { sinDirecciones: true, escala: 0.42, porFila: 5 });
  const rets = (s.retornos ?? []).map(r => `<span class="ret">↩ ${esc(r === null ? 'NULL' : r)}</span>`).join(' ');
  return `<div class="test-dibujo"><div class="lado"><span class="rot">entrada</span>${entrada}</div>`
    + `<div class="llamada"><code>${esc(d.llamadas)}</code><span>→</span></div>`
    + `<div class="lado"><span class="rot">se espera</span>${salida}${rets ? `<div>${rets}</div>` : ''}</div></div>`;
}

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Lista de resultados: nombre, estado y, si falla, salida esperada y obtenida lado a lado.
export function htmlResultados(tests, resultados) {
  const icono = { ok: '✅', falla: '❌', error: '💥', pendiente: '⏳', 'sin-compilar': '⚪', 'sin-correr': '○' };
  return tests.map((t, i) => {
    const r = resultados[i];
    const abierto = r.estado === 'falla' || r.estado === 'error';
    return `<details class="test ${r.estado}" ${abierto ? 'open' : ''}>
      <summary>${icono[r.estado]} ${esc(t.nombre)}${t.idx != null ? `<button class="ver-vis" data-vis="${t.paso}.${t.idx}" title="Ejecutar este test paso a paso y ver la memoria">👁 Ver</button>` : ''}</summary>
      ${htmlTest(t)}
      ${r.estado === 'pendiente' || r.estado === 'sin-compilar' || r.estado === 'sin-correr' ? '' : `
      <div class="salidas">
        <div><h4>Esperado</h4><pre>${esc(t.esperado)}</pre></div>
        <div><h4>Obtenido</h4><pre>${esc(r.obtenido) || '<span class="vacio">(nada)</span>'}</pre></div>
      </div>`}
      ${r.error ? `<p class="error-ej">${esc(r.error)}</p>` : ''}
    </details>`;
  }).join('');
}
