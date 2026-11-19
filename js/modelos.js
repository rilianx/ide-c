// Lo que cambia según la estructura del ejercicio (ej.modelo): cómo se dibuja la memoria,
// cómo se arma el estado de la entrada y la salida esperada de un test, cómo se compara y
// cómo se explica un error. «lista» (Lab 2) es el modelo por omisión; «tabla» es la tabla hash (Lab 3).
import { svgLista, esperadoLista, estadoDeLista, compararConEsperado, lugaresDe, diagnosticar, htmlVariables } from './visual.js?v=202611190258';
import { svgTabla, estadoEntradaTabla, estadoSalidaTabla, textoEsperadoTabla, esperadoTabla, compararTabla, nombresFallasTabla, diagnosticarTabla, htmlVariablesTabla, vaciaTabla } from './tabla.js?v=202611190258';

import { svgArbol, estadoEntradaArbol, estadoSalidaArbol, textoEsperadoArbol, esperadoArbol, compararArbol, nombresFallasArbol, lugaresArbol, diagnosticarArbol, htmlVariablesArbol, vacioArbol } from './arbol.js?v=202611190258';

const esc = x => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const LISTA = {
  esperado: esperadoLista,
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
  esperado: esperadoTabla,
  textoEsperado: textoEsperadoTabla, esperadoTabla,
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
const ARBOL = {
  esperado: esperadoArbol,
  textoEsperado: textoEsperadoArbol,
  svg: svgArbol,
  sinEntrada: 'sin árbol',
  estadoEntrada: estadoEntradaArbol,
  estadoSalida: estadoSalidaArbol,
  comparar: compararArbol,
  nombresFallas: nombresFallasArbol,
  lugares: lugaresArbol,
  diagnosticar: diagnosticarArbol,
  htmlVariables: htmlVariablesArbol,
  vacio: vacioArbol,
  opcionesMini: {},
};
// El dibujo de un estado con lo que se espera al final anotado encima (sin un segundo dibujo).
const anotado = M => (estado, salida, nombre, opciones = {}) => {
  const esp = M.esperado(estado, salida);
  let e = estado;
  if (Number.isInteger(esp.retorno) && esp.retorno >= 0) e = { ...estado, vars: [...(estado.vars ?? []).filter(v => v.nombre !== 'return'), { nombre: 'return', ptr: esp.retorno }] };
  return M.svg(e, nombre, { ...opciones, esperado: esp });
};
LISTA.anotado = anotado(LISTA);
TABLA.anotado = anotado(TABLA);
ARBOL.anotado = anotado(ARBOL);
export const modeloDe = ej => ej?.modelo === 'tabla' ? TABLA : ej?.modelo === 'arbol' ? ARBOL : LISTA;
