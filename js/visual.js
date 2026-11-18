// Dibujo estático de la memoria de una lista doble (como en el cuaderno del juego o
// las figuras del libro): la List con head, tail y current, y cada nodo como una caja
// [prev | dato | next] con flechas. No hay animación: un dibujo por estado.

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const hex = d => '0x' + (Number(d) % 0x10000).toString(16).padStart(3, '0');   // dirección corta

// Medidas
const CP = 26, CD = 46, CN = 26;        // celdas prev, dato, next
const AN = CP + CD + CN, AL = 38;       // ancho y alto de un nodo
const SEP = 58;                         // espacio entre nodos
const X0 = 64, YL = 26, YN = 150;       // margen, fila de la List, fila de los nodos
const CL = 70;                          // ancho de cada campo de la List

export function svgLista(estado, nombre = 'L') {
  const nodos = estado?.nodos ?? [], vars = estado?.vars ?? [];
  let L = estado?.lista;
  if (L === null || L === '?' || !L) {   // sin lista: igual se dibujan los nodos de las variables
    if (!nodos.length && !vars.length) return `<p class="nota">${esc(nombre)} ${L === '?' ? 'apunta a una dirección inválida (basura)' : 'aún no existe (NULL)'}.</p>`;
    L = { sinLista: true, estado: L, head: null, tail: null, current: null };
  }

  // Orden: primero la cadena desde head siguiendo next; los demás en una segunda fila.
  const orden = [], visto = new Set();
  for (let i = L.head; Number.isInteger(i) && !visto.has(i); i = nodos[i].next) { visto.add(i); orden.push(i); }
  let resto = nodos.map((n, i) => i).filter(i => !visto.has(i));
  // Un nodo que aún no está en la lista pero ya apunta a uno de ella se dibuja a su lado
  // (antes de su next o después de su prev), con borde punteado.
  const fila = [...orden], fuera = new Set(resto);
  for (let cambio = true; cambio;) {
    cambio = false;
    for (const r of resto) {
      const q = fila.indexOf(nodos[r].next), p = fila.indexOf(nodos[r].prev);
      if (q >= 0) fila.splice(q, 0, r); else if (p >= 0) fila.splice(p + 1, 0, r); else continue;
      resto = resto.filter(x => x !== r); cambio = true; break;
    }
  }
  const pos = new Map();
  fila.forEach((i, k) => pos.set(i, { x: X0 + k * (AN + SEP), y: YN }));
  const fila2 = fila.length ? 120 : 0;   // si no hay cadena desde head, los demás van en la primera fila
  resto.forEach((i, k) => pos.set(i, { x: X0 + k * (AN + SEP), y: YN + fila2 }));

  // variables (nuevo, aux…): etiquetas amarillas debajo de su nodo
  const porNodo = new Map(), sueltas = [];
  for (const v of vars) {
    if (Number.isInteger(v.ptr)) { if (!porNodo.has(v.ptr)) porNodo.set(v.ptr, []); porNodo.get(v.ptr).push(v.nombre); }
    else sueltas.push(`${v.nombre} = ${v.ptr === null ? 'NULL' : '? (basura)'}`);
  }
  const conVars = porNodo.size > 0, BAJO = conVars ? 44 : 0;
  if (conVars && fila2) resto.forEach(i => { pos.get(i).y += BAJO; });
  const yUltima = resto.length && fila2 ? YN + 120 + BAJO : YN;
  const ancho = Math.max(X0 + 3 * CL + 120, X0 + Math.max(fila.length, resto.length, 1) * (AN + SEP) + 20, resto.length ? 470 : 0);
  const alto = yUltima + AL + 40 + BAJO + (sueltas.length ? 22 : 0);
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
    s.push(`<rect x="${x}" y="${y}" width="${AN}" height="${AL}" class="nodo${fuera.has(i) ? ' fuera' : ''}"/>`);
    s.push(`<line x1="${x + CP}" y1="${y}" x2="${x + CP}" y2="${y + AL}" class="div"/>`);
    s.push(`<line x1="${x + CP + CD}" y1="${y}" x2="${x + CP + CD}" y2="${y + AL}" class="div"/>`);
    s.push(n.dato === '?' ? `<text x="${x + CP + CD / 2}" y="${y + AL / 2 + 5}" class="basura">?</text>`
      : `<text x="${x + CP + CD / 2}" y="${y + AL / 2 + 6}" class="dato">${n.dato === null ? 'NULL' : esc(n.dato)}</text>`);
    s.push(`<text x="${x + AN / 2}" y="${y + AL + 15}" class="dir">${hex(n.dir)}</text>`);
  });
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
      if (t.y === y && t.x > x && t.x - x === AN + SEP) flecha(`M${ox},${yn} L${t.x - 1},${yn}`, 'next');   // al vecino de la derecha
      else {   // a otro lado: arco por arriba
        const tx = t.x + 8, ty = t.y, alto = 28 + Math.abs(t.x - x) / 8;
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
      if (t.y === y && x - t.x === AN + SEP) flecha(`M${ox},${yp} C${ox - 14},${yp} ${t.x + AN + 16},${yp} ${t.x + AN + 1},${yp}`, 'prev');   // al vecino de la izquierda
      else {   // a otro lado: arco por abajo
        const tx = t.x + AN - 8, ty = t.y + AL, bajo = 30 + Math.abs(t.x - x) / 8;
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
  if (resto.length && fila.length) s.push(`<text x="${X0}" y="${YN + 104 + BAJO}" class="nota-svg">fuera de la lista (no se alcanzan desde head siguiendo next):</text>`);
  if (!nodos.length) s.push(`<text x="${X0}" y="${YN + 20}" class="nota-svg">(sin nodos)</text>`);

  const marca = c => `<marker id="punta-${c}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="punta ${c}"/></marker>`;
  return `<svg class="memoria" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}" role="img" aria-label="Memoria de la lista">
<defs>${['head', 'tail', 'current', 'next', 'prev', 'var'].map(marca).join('')}</defs>${s.join('')}</svg>`;
}
