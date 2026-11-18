// Tests: cada uno es un trozo de C que usa solo la interfaz (.h) e imprime algo;
// se compara su salida con la esperada. Si un test se cuelga (ciclo infinito),
// se detiene y se siguen corriendo los que faltan.
import { armarTests, mismaSalida, mensajes } from './proyecto.js?v=202611181541';

// tests: [{nombre, codigo, esperado, paso}]; alActualizar(resultados) se llama a medida que avanzan.
// Devuelve {compilacion, resultados} con resultados[i] = {estado, obtenido, error}.
export async function correrTests(runner, ej, archivos, ocultos, tests, alActualizar = () => {}) {
  const resultados = tests.map(() => ({ estado: 'pendiente', obtenido: '', error: null }));
  alActualizar(resultados);
  let compilacion = null;
  let faltan = tests.map((t, i) => i);
  while (faltan.length) {
    const prog = armarTests(ej, archivos, ocultos, faltan.map(i => tests[i]));
    const r = await runner.ejecutar(prog, {
      llamada: d => {
        const i = faltan[d.id], t = tests[i];
        resultados[i] = {
          estado: d.error ? 'error' : !d.ok ? 'error' : mismaSalida(t.esperado, d.stdout) ? 'ok' : 'falla',
          obtenido: d.stdout, error: d.error ?? (d.ok ? null : d.stderr.trim() || 'No se pudo ejecutar'),
        };
        alActualizar(resultados);
      },
    });
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

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Lista de resultados: nombre, estado y, si falla, salida esperada y obtenida lado a lado.
export function htmlResultados(tests, resultados) {
  const icono = { ok: '✅', falla: '❌', error: '💥', pendiente: '⏳', 'sin-compilar': '⚪', 'sin-correr': '○' };
  return tests.map((t, i) => {
    const r = resultados[i];
    const abierto = r.estado === 'falla' || r.estado === 'error';
    return `<details class="test ${r.estado}" ${abierto ? 'open' : ''}>
      <summary>${icono[r.estado]} ${esc(t.nombre)}${t.idx != null ? `<button class="ver-vis" data-vis="${t.paso}.${t.idx}" title="Ejecutar este test paso a paso y ver la memoria">👁 Ver</button>` : ''}</summary>
      <pre class="codigo-test">${esc(t.codigo)}</pre>
      ${r.estado === 'pendiente' || r.estado === 'sin-compilar' || r.estado === 'sin-correr' ? '' : `
      <div class="salidas">
        <div><h4>Esperado</h4><pre>${esc(t.esperado)}</pre></div>
        <div><h4>Obtenido</h4><pre>${esc(r.obtenido) || '<span class="vacio">(nada)</span>'}</pre></div>
      </div>`}
      ${r.error ? `<p class="error-ej">${esc(r.error)}</p>` : ''}
    </details>`;
  }).join('');
}
