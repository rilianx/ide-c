// Lo que cambia según la estructura del ejercicio (ej.modelo): cómo se dibuja la memoria,
// cómo se arma el estado de la entrada y la salida esperada de un test, cómo se compara y
// cómo se explica un error. «lista» (Lab 2) es el modelo por omisión; «tabla» es la tabla hash (Lab 3).
import { svgLista, estadoDeLista, compararConEsperado, lugaresDe, diagnosticar, htmlVariables } from './visual.js?v=202611190201';
import { svgTabla, estadoEntradaTabla, estadoSalidaTabla, textoEsperadoTabla, compararTabla, nombresFallasTabla, diagnosticarTabla, htmlVariablesTabla, vaciaTabla } from './tabla.js?v=202611190201';

const esc = x => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const LISTA = {
  textoEsperado: t => (t.salida?.retornos ?? []).map(r => `<span class="ret">↩ ${esc(r === null ? 'NULL' : r)}</span>`).join(' '),
  svg: svgLista,
  sinEntrada: 'sin lista',
  estadoEntrada: t => { const e = t.entrada ?? {}; return e.lista == null ? null : estadoDeLista(e.lista, Number.isInteger(e.current) ? e.current : null); },
  estadoSalida: t => { const s = t.salida ?? {}; return estadoDeLista(s.lista, 'current' in s ? s.current : undefined, true); },
  comparar: compararConEsperado,
  nombresFallas: { datos: 'los datos de la lista', head: 'head', tail: 'tail', current: 'current', prev: 'los prev', lista: 'la lista' },
  lugares: lugaresDe,
  diagnosticar,
  htmlVariables,
  vacio: estado => !estado?.lista && !(estado?.nodos ?? []).length,
  opcionesMini: { porFila: 5 },
};
const TABLA = {
  textoEsperado: textoEsperadoTabla,
  svg: svgTabla,
  sinEntrada: 'sin tabla',
  estadoEntrada: estadoEntradaTabla,
  estadoSalida: estadoSalidaTabla,
  comparar: compararTabla,
  nombresFallas: nombresFallasTabla,
  lugares: () => new Map(),
  diagnosticar: diagnosticarTabla,
  htmlVariables: htmlVariablesTabla,
  vacio: vaciaTabla,
  opcionesMini: { porFila: 10 },
};
export const modeloDe = ej => ej?.modelo === 'tabla' ? TABLA : LISTA;
