// Dibujo estático de la memoria de una lista doble (como en el cuaderno del juego o
// las figuras del libro): la List con head, tail y current, y cada nodo como una caja
// [prev | dato | next] con flechas. No hay animación: un dibujo por estado.

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const hex = d => '0x' + (Number(d) % 0x10000).toString(16).padStart(3, '0');   // dirección corta

// Variables que no son punteros a nodos (enteros, contadores, textos, datos) como cajitas amarillas
// [nombre / valor] en una fila desde (x, y); lo que retorna va en verde. → {svg, ancho}
export function svgEnteros(vars, x, y) {
  const vs = (vars ?? []).filter(v => !('ptr' in v));
  if (!vs.length) return { svg: '', ancho: 0 };
  const valor = v => 'valor' in v ? String(v.valor)
    : 'texto' in v ? (v.texto === null ? 'NULL' : v.texto === '?' ? '?' : `"${v.texto.t}"`)
    : v.dato === null ? 'NULL' : v.dato === '?' ? '?' : String(v.dato);
  const out = [];
  let cx = x;
  for (const v of vs) {
    const nombre = v.nombre === 'return' ? '↩ retorna' : v.nombre, val = valor(v);
    const w = Math.max(40, nombre.length * 7 + 14, val.length * 10 + 14);
    out.push(`<rect x="${cx}" y="${y}" width="${w}" height="40" rx="3" class="etiqueta${v.nombre === 'return' ? ' retorno' : ''}"/>`);
    out.push(`<text x="${cx + w / 2}" y="${y + 13}" class="campo">${esc(nombre)}</text>`);
    out.push(`<text x="${cx + w / 2}" y="${y + 33}" class="dato num">${esc(val)}</text>`);
    if (v.nombre !== 'return') out.push(`<rect x="${cx}" y="${y}" width="${w}" height="40" class="toque" data-expr="${esc(v.nombre)}"/>`);
    cx += w + 8;
  }
  return { svg: out.join(''), ancho: cx - x };
}

// Medidas
const CP = 26, CD = 46, CN = 26;        // celdas prev, dato, next
const AN = CP + CD + CN, AL = 38;       // ancho y alto de un nodo
const SEP = 58;                         // espacio entre nodos
const X0 = 64, YL = 16, YN = 128;       // margen, fila de la List, fila de los nodos
const CL = 70;                          // ancho de cada campo de la List

// Cada nodo tiene un lugar fijo durante toda la ejecución (no se mueve al cambiar los punteros).
// Solo al comienzo (la entrada) están ordenados: los nodos de la lista de entrada, en su orden;
// los que se crean después van a continuación, en el orden en que aparecen.
// Se identifica por su dirección: si otro nodo ocupa después esa memoria, ocupa también su lugar.
// opciones.lugares: Map dirección → lugar (si no se da, el orden de la lista de este estado).
export function lugaresDe(estados) {
  const cadena = e => {   // direcciones desde head siguiendo next
    const ns = e?.nodos ?? [], out = [], visto = new Set();
    for (let i = e?.lista?.head; Number.isInteger(i) && !visto.has(i) && ns[i]; i = ns[i].next) { visto.add(i); out.push(ns[i].dir); }
    return out;
  };
  const inicial = estados.find(e => e?.lista && typeof e.lista === 'object');
  const orden = [...new Set([...cadena(inicial), ...estados.flatMap(e => (e?.nodos ?? []).map(n => n.dir))])];
  return new Map(orden.map((d, k) => [d, k]));
}
// Estado (como el del volcado) de una lista dada por sus datos: para dibujar la entrada y la salida
// esperada de un test. current: posición (entrada) o dato (salida); undefined = no se revisa.
export function estadoDeLista(datos, current, porDato = false) {
  const nodos = (datos ?? []).map((d, i, a) => ({ dir: i + 1, dato: d, next: i + 1 < a.length ? i + 1 : null, prev: i ? i - 1 : null }));
  const cur = current === undefined ? undefined : current === null ? null
    : porDato ? (datos.indexOf(current) >= 0 ? datos.indexOf(current) : null) : current;
  return { lista: { dir: 0, head: nodos.length ? 0 : null, tail: nodos.length ? nodos.length - 1 : null, current: cur }, nodos, vars: [] };
}

// Compara el estado final con la salida esperada de un test: marcas para el dibujo y qué falló.
export function compararConEsperado(estado, salida) {
  const L = estado?.lista, ns = estado?.nodos ?? [], esp = salida.lista ?? [];
  const marcas = { nodos: new Map(), prev: new Set() }, fallas = [];
  if (!L || typeof L !== 'object') return { marcas, fallas: ['lista'] };
  const cadena = [], visto = new Set();
  for (let i = L.head; Number.isInteger(i) && !visto.has(i) && cadena.length < 60; i = ns[i]?.next) { visto.add(i); cadena.push(i); }
  cadena.forEach((i, k) => marcas.nodos.set(i, k < esp.length && ns[i].dato === esp[k] ? 'ok' : 'mal'));
  if (cadena.length !== esp.length || [...marcas.nodos.values()].includes('mal')) fallas.push('datos');
  const bien = (i, dato) => dato === undefined ? i === null : Number.isInteger(i) && ns[i]?.dato === dato;
  marcas.head = (esp.length ? L.head === cadena[0] && bien(L.head, esp[0]) : L.head === null) ? 'ok' : 'mal';
  marcas.tail = (esp.length ? L.tail === cadena.at(-1) && bien(L.tail, esp.at(-1)) : L.tail === null) ? 'ok' : 'mal';
  if ('current' in salida) marcas.current = (salida.current === null ? L.current === null : bien(L.current, salida.current)) ? 'ok' : 'mal';
  for (const c of ['head', 'tail', 'current']) if (marcas[c] === 'mal') fallas.push(c);
  cadena.forEach((i, k) => { if (ns[i].prev !== (k ? cadena[k - 1] : null)) marcas.prev.add(i); });
  if (marcas.prev.size) fallas.push('prev');
  return { marcas, fallas };
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
    if (!('ptr' in v)) continue;   // enteros y datos: van en la tabla (fuera del dibujo)
    const nombre = v.nombre === 'return' ? '↩ retorna' : v.nombre;
    if (Number.isInteger(v.ptr)) { if (!porNodo.has(v.ptr)) porNodo.set(v.ptr, []); porNodo.get(v.ptr).push(nombre); }
    else sueltas.push(`${nombre} = ${v.ptr === null ? 'NULL' : '? (basura)'}`);
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
  const enteros = svgEnteros(vars, X0 + 3 * CL + 56, YL);   // contadores, enteros… al lado de la List
  const ancho = Math.max(X0 + 3 * CL + 120, X0 + Math.min(Math.max(maxLugar + 1, 1), POR_FILA) * (AN + SEP) + 30, X0 + 3 * CL + 64 + enteros.ancho);
  const alto = lugares.size ? yUltima + AL + 62 + BAJO + (sueltas.length ? 22 : 0) : YL + AL + 46 + (sueltas.length ? 22 : 0);
  const s = [];

  // Flecha con punta
  const tgtBase = s;
  let tgt = s;   // los elementos de un nodo liberado van aparte (semitransparentes, en rojo)
  const sLib = [];
  // marcas (comparación con lo esperado): 'ok' en verde, 'mal' en rojo
  const marcas = opciones.marcas ?? {};
  const flecha = (d, clase, marca = '') => tgt.push(`<path d="${d}" class="flecha ${clase} ${marca}" marker-end="url(#punta-${marca || clase})"/>`);
  const nulo = (x, y, w, h, marca = '') => tgt.push(`<line x1="${x + 4}" y1="${y + h - 4}" x2="${x + w - 4}" y2="${y + 4}" class="nulo ${marca}"/>`);
  const basura = (x, y, w, h) => tgt.push(`<text x="${x + w / 2}" y="${y + h / 2 + 5}" class="basura">?</text>`);

  // La List
  if (L.sinLista) s.push(`<text x="${X0}" y="${YL + 26}" class="nota-svg">${esc(nombre)} ${L.estado === '?' ? 'es basura' : 'aún no existe (NULL)'}</text>`);
  else {
  s.push(`<text x="${X0 - 8}" y="${YL + 26}" class="nombre" text-anchor="end">${esc(nombre)}</text>`);
  s.push(`<rect x="${X0}" y="${YL}" width="${3 * CL}" height="${AL + 6}" class="lista"/>`);
  ['head', 'tail', 'current'].forEach((campo, k) => {
    const x = X0 + k * CL;
    if (k) s.push(`<line x1="${x}" y1="${YL}" x2="${x}" y2="${YL + AL + 6}" class="div"/>`);
    s.push(`<text x="${x + CL / 2}" y="${YL + 14}" class="campo">${campo}</text>`);
    const v = L[campo], mk = marcas[campo] ?? '';
    if (mk) s.push(`<rect x="${x + 2}" y="${YL + 2}" width="${CL - 4}" height="${AL + 2}" class="celda ${mk}"/>`);
    if (v === undefined) s.push(`<text x="${x + CL / 2}" y="${YL + 34}" class="campo">—</text>`);   // no se revisa
    else if (v === null) nulo(x + 10, YL + 18, CL - 20, AL - 16, mk);
    else if (v === '?') basura(x, YL + 14, CL, AL - 10);
    else {
      const p = pos.get(v);
      const ox = x + CL / 2, oy = YL + 32;
      const dx = p.x + CP + CD / 2 + (k - 1) * 12, dy = p.y - 2;   // cada campo llega a un punto distinto
      s.push(`<circle cx="${ox}" cy="${oy}" r="3" class="punto ${campo}"/>`);
      flecha(`M${ox},${oy} C${ox},${oy + 50} ${dx},${dy - 50} ${dx},${dy}`, campo, mk);
    }
  });
  if (!opciones.sinDirecciones) s.push(`<text x="${X0 + 3 * CL + 6}" y="${YL + AL + 4}" class="dir">${hex(L.dir)}</text>`);
  }

  // Los nodos
  nodos.forEach((n, i) => {
    const { x, y } = pos.get(i);
    const s = n.libre ? sLib : tgtBase;
    s.push(`<rect x="${x}" y="${y}" width="${AN}" height="${AL}" class="nodo${n.libre ? ' liberado' : fuera.has(i) ? ' fuera' : ''} ${marcas.nodos?.get(i) ?? ''}"/>`);
    if (n.libre) s.push(`<text x="${x + AN / 2}" y="${y - 5}" class="liberado">liberado</text>`);
    s.push(`<line x1="${x + CP}" y1="${y}" x2="${x + CP}" y2="${y + AL}" class="div"/>`);
    s.push(`<line x1="${x + CP + CD}" y1="${y}" x2="${x + CP + CD}" y2="${y + AL}" class="div"/>`);
    s.push(n.dato === '?' ? `<text x="${x + CP + CD / 2}" y="${y + AL / 2 + 5}" class="basura">?</text>`
      : `<text x="${x + CP + CD / 2}" y="${y + AL / 2 + 6}" class="dato">${n.dato === null ? 'NULL' : esc(n.dato)}</text>`);
    if (!opciones.sinDirecciones) s.push(`<text x="${x + AN / 2}" y="${y + AL + 15}" class="dir">${hex(n.dir)}</text>`);
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
    tgt = n.libre ? sLib : tgtBase;
    const s = tgt;
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
    if (n.prev === null) nulo(xp, y, CP, AL, marcas.prev?.has(i) ? 'mal' : '');
    else if (n.prev === '?') basura(xp, y, CP, AL);
    else {
      const t = pos.get(n.prev), ox = xp + CP / 2;
      s.push(`<circle cx="${ox}" cy="${yp}" r="3" class="punto"/>`);
      const pi = pos.get(i);
      if (t.y === y && x - t.x === AN + SEP) flecha(`M${ox},${yp} C${ox - 14},${yp} ${t.x + AN + 16},${yp} ${t.x + AN + 1},${yp}`, 'prev', marcas.prev?.has(i) ? 'mal' : '');   // al vecino de la izquierda
      else if (pi.k != null && t.k === pi.k - 1) {   // comienzo de fila: sube al último de la fila anterior
        const xl = x - 14, ym = y - 16, xt = t.x + AN + 26, yt = t.y + AL - 12;
        flecha(`M${ox},${yp} L${xl},${yp} L${xl},${ym} L${xt},${ym} L${xt},${yt} L${t.x + AN + 1},${yt}`, 'prev', marcas.prev?.has(i) ? 'mal' : '');
      }
      else {   // a otro lado: arco por abajo
        const tx = t.x + AN - 8, ty = t.y + AL, bajo = Math.min(48, 30 + Math.abs(t.x - x) / 8);
        flecha(`M${ox},${yp} C${ox - 10},${y + AL + bajo} ${tx},${ty + bajo} ${tx},${ty + 1}`, 'prev', marcas.prev?.has(i) ? 'mal' : '');
      }
    }
  });
  tgt = tgtBase;
  if (sLib.length) s.push(`<g class="grupo-liberado">${sLib.join('')}</g>`);
  // etiquetas de variables
  for (const [i, nombres] of porNodo) {
    const { x, y } = pos.get(i), cx = x + CP + CD / 2, ty = y + AL + 32;
    const w = Math.max(30, nombres.join(', ').length * 8 + 12);
    s.push(`<path d="M${cx},${ty - 4} L${cx},${y + AL + 18}" class="flecha var" marker-end="url(#punta-var)"/>`);
    s.push(`<rect x="${cx - w / 2}" y="${ty - 4}" width="${w}" height="20" rx="3" class="etiqueta${nombres.some(n => n.startsWith('↩')) ? ' retorno' : ''}"/>`);
    s.push(`<text x="${cx}" y="${ty + 10}" class="var">${esc(nombres.join(', '))}</text>`);
  }
  if (sueltas.length) s.push(`<text x="${X0}" y="${alto - 10}" class="nota-svg">${esc(sueltas.join('   '))}</text>`);
  s.push(enteros.svg);
  if (!nodos.length) s.push(`<text x="${X0}" y="${YL + AL + 30}" class="nota-svg">(sin nodos)</text>`);
  // Zonas para tocar: cada parte del dibujo con las expresiones que la nombran (para elegir piezas del asistente)
  const toque = (x, y, w, h, cands) => {
    cands = [...new Set(cands.filter(Boolean))];
    if (cands.length) s.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" class="toque" data-expr="${esc(cands.join('|'))}"/>`);
  };
  const nombresDe = new Map();   // nodo → expresiones que llegan a él (variables, campos de la List y un paso más)
  const agregar = (i, e) => { if (!Number.isInteger(i)) return; if (!nombresDe.has(i)) nombresDe.set(i, []); nombresDe.get(i).push(e); };
  for (const v of vars) if (Number.isInteger(v.ptr) && v.nombre !== 'return') agregar(v.ptr, v.nombre);
  if (!L.sinLista) for (const c of ['head', 'tail', 'current']) agregar(L[c], `${nombre}->${c}`);
  for (const [i, es] of [...nombresDe]) for (const e of [...es]) { agregar(nodos[i]?.next, `${e}->next`); agregar(nodos[i]?.prev, `${e}->prev`); }
  if (!L.sinLista) {
    toque(X0 - 56, YL, 54, AL + 6, [nombre]);
    ['head', 'tail', 'current'].forEach((c, k) => toque(X0 + k * CL, YL, CL, AL + 6, [`${nombre}->${c}`]));
  }
  nodos.forEach((n, i) => {
    const { x, y } = pos.get(i), es = nombresDe.get(i) ?? [];
    toque(x, y, CP, AL, [...es.map(e => `${e}->prev`), ...es]);
    toque(x + CP, y, CD, AL, [...es.map(e => `${e}->data`), ...es]);
    toque(x + CP + CD, y, CN, AL, [...es.map(e => `${e}->next`), ...es]);
  });
  for (const [i, ns] of porNodo) {
    const { x, y } = pos.get(i), cx = x + CP + CD / 2, ty = y + AL + 32, w = Math.max(30, ns.join(', ').length * 8 + 12);
    toque(cx - w / 2, ty - 4, w, 20, ns.filter(n => !n.startsWith('↩')));
  }

  const marca = c => `<marker id="punta-${c}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="punta ${c}"/></marker>`;
  return `<svg class="memoria" viewBox="0 0 ${ancho} ${alto}" style="max-width:${Math.round(ancho * (opciones.escala ?? 0.62))}px" role="img" aria-label="Memoria de la lista">
<defs>${['head', 'tail', 'current', 'next', 'prev', 'var', 'ok', 'mal'].map(marca).join('')}</defs>${s.join('')}</svg>`;
}

// Diagnóstico de un error en una línea: busca en ella expresiones como «a->b->c» y las sigue en
// el estado de la memoria; si alguna parte vale NULL (o basura) antes de un «->», lo explica.
// nombreLista: la variable que es la List; las variables Node * vienen en estado.vars.
export function diagnosticar(linea, estado, nombreLista) {
  if (!estado) return null;
  const nodos = estado.nodos ?? [], L = estado.lista;
  const valorVar = n => {
    if (n === nombreLista) return L === null ? null : L === '?' ? '?' : { lista: true };
    const v = (estado.vars ?? []).find(x => x.nombre === n);
    return v ? (Number.isInteger(v.ptr) ? { nodo: v.ptr } : v.ptr) : undefined;
  };
  const sinTextos = linea.replace(/"(?:\\.|[^"\\])*"/g, '""').replace(/\/\/.*$/, '');
  for (const m of sinTextos.matchAll(/\b([A-Za-z_]\w*)((?:\s*->\s*[A-Za-z_]\w*)+)/g)) {
    let val = valorVar(m[1]), texto = m[1];
    if (val === undefined) continue;   // una variable que no se dibuja (int, void *…)
    for (const campo of m[2].split('->').map(s => s.trim()).filter(Boolean)) {
      if (val === null) return `<code>${texto}</code> es NULL, y la línea hace <code>${texto}->${campo}</code> (no se puede seguir un puntero NULL).`;
      if (val === '?') return `<code>${texto}</code> tiene basura (no se inicializó o apunta a memoria inválida), y la línea hace <code>${texto}->${campo}</code>.`;
      if (val.lista) {
        const i = L[campo];
        val = i === undefined ? undefined : Number.isInteger(i) ? { nodo: i } : i;
      } else if (val.nodo != null) {
        const n = nodos[val.nodo];
        if (n?.libre) return `<code>${texto}</code> apunta a un nodo ya liberado (free), y la línea hace <code>${texto}->${campo}</code>.`;
        const i = n?.[campo];
        val = campo === 'data' || i === undefined ? undefined : Number.isInteger(i) ? { nodo: i } : i;
      }
      texto += '->' + campo;
      if (val === undefined) break;
    }
  }
  return null;
}

// Tabla de las variables que no son punteros a nodos (enteros, double, datos void *) y lo que
// retorna la función (destacado). Los punteros a nodos van como etiquetas en el dibujo.
export function htmlVariables(estado) {
  const vars = estado?.vars ?? [];
  const valor = v => 'valor' in v ? String(v.valor)
    : 'dato' in v ? (v.dato === null ? 'NULL' : v.dato === '?' ? '? (basura)' : `→ ${v.dato}`)
    : v.ptr === null ? 'NULL' : v.ptr === '?' ? '? (basura)' : `→ nodo ${estado.nodos?.[v.ptr]?.dato ?? ''}`;
  const ret = vars.find(v => v.nombre === 'return');
  const otras = vars.filter(v => v.nombre !== 'return' && !('ptr' in v));
  let h = '';
  if (ret) {
    const que = 'dato' in ret && Number.isInteger(ret.dato) ? `el dato <b>${esc(ret.dato)}</b>`
      : 'ptr' in ret && Number.isInteger(ret.ptr) ? `el nodo <b>${esc(estado.nodos?.[ret.ptr]?.dato ?? '')}</b>`
      : `<b>${esc(valor(ret))}</b>`;
    h += `<p class="retorno">↩ retorna ${que}</p>`;
  }
  if (otras.length) h += `<table class="tabla-vars"><tr><th>variable</th><th>valor</th></tr>${otras.map(v =>
    `<tr><td><code>${esc(v.nombre)}</code></td><td><code>${esc(valor(v))}</code></td></tr>`).join('')}</table>`;
  return h;
}
