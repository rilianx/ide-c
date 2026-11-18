// Dibujo estático de la memoria de una lista doble (como en el cuaderno del juego o
// las figuras del libro): la List con head, tail y current, y cada nodo como una caja
// [prev | dato | next] con flechas. No hay animación: un dibujo por estado.

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const hex = d => '0x' + (Number(d) % 0x10000).toString(16).padStart(3, '0');   // dirección corta

// Medidas
const CP = 26, CD = 46, CN = 26;        // celdas prev, dato, next
const AN = CP + CD + CN, AL = 38;       // ancho y alto de un nodo
const SEP = 58;                         // espacio entre nodos
const X0 = 64, YL = 16, YN = 128;       // margen, fila de la List, fila de los nodos
const CL = 70;                          // ancho de cada campo de la List

// Los nodos se dibujan como en la memoria: cada uno en un lugar fijo según su dirección
// (no se mueven al cambiar los enlaces; solo cambian las flechas).
// opciones.lugares: Map dirección → lugar, el mismo para todos los dibujos de una ejecución
// (si no se da, se ordenan las direcciones de este estado). opciones.porFila: lugares por fila.
export function lugaresDe(estados) {
  const dirs = [...new Set(estados.flatMap(e => (e?.nodos ?? []).map(n => n.dir)))].sort((a, b) => a - b);
  return new Map(dirs.map((d, k) => [d, k]));
}
export function svgLista(estado, nombre = 'L', opciones = {}) {
  const POR_FILA = Math.max(2, opciones.porFila ?? (innerWidth <= 600 ? 3 : 5));
  const lugares = opciones.lugares ?? lugaresDe([estado]);
  const nodos = estado?.nodos ?? [], vars = estado?.vars ?? [];
  let L = estado?.lista;
  if (L === null || L === '?' || !L) {   // sin lista: igual se dibujan los nodos de las variables
    if (!nodos.length && !vars.length) return `<p class="nota">${esc(nombre)} ${L === '?' ? 'apunta a una dirección inválida (basura)' : 'aún no existe (NULL)'}.</p>`;
    L = { sinLista: true, estado: L, head: null, tail: null, current: null };
  }

  // Los que se alcanzan desde head siguiendo next están en la lista; los demás se dibujan punteados.
  const visto = new Set();
  for (let i = L.head; Number.isInteger(i) && !visto.has(i); i = nodos[i].next) visto.add(i);
  const fuera = new Set(nodos.map((n, i) => i).filter(i => !visto.has(i)));

  // variables (nuevo, aux…): etiquetas amarillas debajo de su nodo
  const porNodo = new Map(), sueltas = [];
  for (const v of vars) {
    if (Number.isInteger(v.ptr)) { if (!porNodo.has(v.ptr)) porNodo.set(v.ptr, []); porNodo.get(v.ptr).push(v.nombre); }
    else sueltas.push(`${v.nombre} = ${v.ptr === null ? 'NULL' : '? (basura)'}`);
  }
  const conVars = porNodo.size > 0, BAJO = conVars ? 44 : 0;

  // Posiciones: un lugar fijo por dirección, en filas de POR_FILA (la lista de lugares es la de
  // toda la ejecución, así el dibujo no cambia de tamaño entre pasos).
  const pos = new Map(), ALTO_FILA = AL + 64 + BAJO;
  let maxLugar = lugares.size - 1;
  nodos.forEach((n, i) => {
    let k = lugares.get(n.dir);
    if (k == null) { k = ++maxLugar; lugares.set(n.dir, k); }
    pos.set(i, { x: X0 + (k % POR_FILA) * (AN + SEP), y: YN + Math.floor(k / POR_FILA) * ALTO_FILA, k });
  });
  const filas = Math.max(1, Math.ceil((maxLugar + 1) / POR_FILA));
  const yUltima = YN + (filas - 1) * ALTO_FILA;
  const ancho = Math.max(X0 + 3 * CL + 120, X0 + Math.min(Math.max(maxLugar + 1, 1), POR_FILA) * (AN + SEP) + 30);
  const alto = lugares.size ? yUltima + AL + 62 + BAJO + (sueltas.length ? 22 : 0) : YL + AL + 46 + (sueltas.length ? 22 : 0);
  const s = [];

  // Flecha con punta
  const flecha = (d, clase) => s.push(`<path d="${d}" class="flecha ${clase}" marker-end="url(#punta-${clase})"/>`);
  const nulo = (x, y, w, h) => s.push(`<line x1="${x + 4}" y1="${y + h - 4}" x2="${x + w - 4}" y2="${y + 4}" class="nulo"/>`);
  const basura = (x, y, w, h) => s.push(`<text x="${x + w / 2}" y="${y + h / 2 + 5}" class="basura">?</text>`);

  // La List
  if (L.sinLista) s.push(`<text x="${X0}" y="${YL + 26}" class="nota-svg">${esc(nombre)} ${L.estado === '?' ? 'es basura' : 'aún no existe (NULL)'}</text>`);
  else {
  s.push(`<text x="${X0 - 8}" y="${YL + 26}" class="nombre" text-anchor="end">${esc(nombre)}</text>`);
  s.push(`<rect x="${X0}" y="${YL}" width="${3 * CL}" height="${AL + 6}" class="lista"/>`);
  ['head', 'tail', 'current'].forEach((campo, k) => {
    const x = X0 + k * CL;
    if (k) s.push(`<line x1="${x}" y1="${YL}" x2="${x}" y2="${YL + AL + 6}" class="div"/>`);
    s.push(`<text x="${x + CL / 2}" y="${YL + 14}" class="campo">${campo}</text>`);
    const v = L[campo];
    if (v === null) nulo(x + 10, YL + 18, CL - 20, AL - 16);
    else if (v === '?') basura(x, YL + 14, CL, AL - 10);
    else {
      const p = pos.get(v);
      const ox = x + CL / 2, oy = YL + 32;
      const dx = p.x + CP + CD / 2 + (k - 1) * 12, dy = p.y - 2;   // cada campo llega a un punto distinto
      s.push(`<circle cx="${ox}" cy="${oy}" r="3" class="punto ${campo}"/>`);
      flecha(`M${ox},${oy} C${ox},${oy + 50} ${dx},${dy - 50} ${dx},${dy}`, campo);
    }
  });
  s.push(`<text x="${X0 + 3 * CL + 6}" y="${YL + AL + 4}" class="dir">${hex(L.dir)}</text>`);
  }

  // Los nodos
  nodos.forEach((n, i) => {
    const { x, y } = pos.get(i);
    s.push(`<rect x="${x}" y="${y}" width="${AN}" height="${AL}" class="nodo${n.libre ? ' liberado' : fuera.has(i) ? ' fuera' : ''}"/>`);
    if (n.libre) s.push(`<text x="${x + AN / 2}" y="${y - 5}" class="liberado">liberado (free)</text>`);
    s.push(`<line x1="${x + CP}" y1="${y}" x2="${x + CP}" y2="${y + AL}" class="div"/>`);
    s.push(`<line x1="${x + CP + CD}" y1="${y}" x2="${x + CP + CD}" y2="${y + AL}" class="div"/>`);
    s.push(n.dato === '?' ? `<text x="${x + CP + CD / 2}" y="${y + AL / 2 + 5}" class="basura">?</text>`
      : `<text x="${x + CP + CD / 2}" y="${y + AL / 2 + 6}" class="dato">${n.dato === null ? 'NULL' : esc(n.dato)}</text>`);
    s.push(`<text x="${x + AN / 2}" y="${y + AL + 15}" class="dir">${hex(n.dir)}</text>`);
  });
  // Nodos ya liberados que nadie apunta: queda su lugar marcado (la memoria no se mueve)
  const enDibujo = new Set(nodos.map(n => n.dir));
  for (const d of estado?.liberados ?? []) {
    const k = lugares.get(d);
    if (k == null || enDibujo.has(d)) continue;
    const x = X0 + (k % POR_FILA) * (AN + SEP), y = YN + Math.floor(k / POR_FILA) * ALTO_FILA;
    s.push(`<rect x="${x}" y="${y}" width="${AN}" height="${AL}" class="nodo liberado"/>`);
    s.push(`<text x="${x + AN / 2}" y="${y + AL / 2 + 5}" class="liberado">liberado</text>`);
    s.push(`<text x="${x + AN / 2}" y="${y + AL + 15}" class="dir">${hex(d)}</text>`);
  }
  // Campos next (arriba) y prev (abajo) de cada nodo
  nodos.forEach((n, i) => {
    const { x, y } = pos.get(i);
    // next
    const xn = x + CP + CD, yn = y + 12;
    if (n.next === null) nulo(xn, y, CN, AL);
    else if (n.next === '?') basura(xn, y, CN, AL);
    else {
      const t = pos.get(n.next), ox = xn + CN / 2;
      s.push(`<circle cx="${ox}" cy="${yn}" r="3" class="punto"/>`);
      const pi = pos.get(i);
      if (t.y === y && t.x > x && t.x - x === AN + SEP) flecha(`M${ox},${yn} L${t.x - 1},${yn}`, 'next');   // al vecino de la derecha
      else if (pi.k != null && t.k === pi.k + 1) {   // fin de fila: baja y vuelve al comienzo de la siguiente
        const xr = x + AN + 14, ym = t.y - 30;
        flecha(`M${ox},${yn} L${xr},${yn} L${xr},${ym} L${t.x + 10},${ym} L${t.x + 10},${t.y - 1}`, 'next');
      }
      else {   // a otro lado: arco por arriba
        const tx = t.x + 8, ty = t.y, alto = Math.min(48, 28 + Math.abs(t.x - x) / 8);
        flecha(`M${ox},${yn} C${ox + 10},${y - alto} ${tx},${ty - alto} ${tx},${ty - 1}`, 'next');
      }
    }
    // prev
    const xp = x, yp = y + AL - 12;
    if (n.prev === null) nulo(xp, y, CP, AL);
    else if (n.prev === '?') basura(xp, y, CP, AL);
    else {
      const t = pos.get(n.prev), ox = xp + CP / 2;
      s.push(`<circle cx="${ox}" cy="${yp}" r="3" class="punto"/>`);
      const pi = pos.get(i);
      if (t.y === y && x - t.x === AN + SEP) flecha(`M${ox},${yp} C${ox - 14},${yp} ${t.x + AN + 16},${yp} ${t.x + AN + 1},${yp}`, 'prev');   // al vecino de la izquierda
      else if (pi.k != null && t.k === pi.k - 1) {   // comienzo de fila: sube al último de la fila anterior
        const xl = x - 14, ym = y - 16, xt = t.x + AN + 26, yt = t.y + AL - 12;
        flecha(`M${ox},${yp} L${xl},${yp} L${xl},${ym} L${xt},${ym} L${xt},${yt} L${t.x + AN + 1},${yt}`, 'prev');
      }
      else {   // a otro lado: arco por abajo
        const tx = t.x + AN - 8, ty = t.y + AL, bajo = Math.min(48, 30 + Math.abs(t.x - x) / 8);
        flecha(`M${ox},${yp} C${ox - 10},${y + AL + bajo} ${tx},${ty + bajo} ${tx},${ty + 1}`, 'prev');
      }
    }
  });
  // etiquetas de variables
  for (const [i, nombres] of porNodo) {
    const { x, y } = pos.get(i), cx = x + CP + CD / 2, ty = y + AL + 32;
    const w = Math.max(30, nombres.join(', ').length * 8 + 12);
    s.push(`<path d="M${cx},${ty - 4} L${cx},${y + AL + 18}" class="flecha var" marker-end="url(#punta-var)"/>`);
    s.push(`<rect x="${cx - w / 2}" y="${ty - 4}" width="${w}" height="20" rx="3" class="etiqueta"/>`);
    s.push(`<text x="${cx}" y="${ty + 10}" class="var">${esc(nombres.join(', '))}</text>`);
  }
  if (sueltas.length) s.push(`<text x="${X0}" y="${alto - 10}" class="nota-svg">${esc(sueltas.join('   '))}</text>`);
  if (!nodos.length) s.push(`<text x="${X0}" y="${YL + AL + 30}" class="nota-svg">(sin nodos)</text>`);

  const marca = c => `<marker id="punta-${c}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="punta ${c}"/></marker>`;
  return `<svg class="memoria" viewBox="0 0 ${ancho} ${alto}" style="max-width:${Math.round(ancho * 0.8)}px" role="img" aria-label="Memoria de la lista">
<defs>${['head', 'tail', 'current', 'next', 'prev', 'var'].map(marca).join('')}</defs>${s.join('')}</svg>`;
}
