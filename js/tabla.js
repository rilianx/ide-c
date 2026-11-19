// Modelo «tabla hash» (Lab 3): tests declarativos y dibujo estático de un HashMap
// (direccionamiento abierto): el HashMap con sus campos, el arreglo buckets con sus índices
// y, debajo de cada casilla ocupada, el Pair [key | value]. Un par inválido (key NULL) va gris.

import { svgEnteros } from './visual.js?v=202611191704';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const hex = d => '0x' + (Number(d) % 0x10000).toString(16).padStart(3, '0');
const valorTexto = v => v === null || v === undefined ? 'NULL' : String(v);
const valida = k => k != null && !String(k).startsWith('~');
const cadena = s => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

// ---------- Tests declarativos ----------
//   entrada: {tabla: ["olla", null, "~cesa", ...] (null: casilla vacía; "~…": par inválido), current: 0}
//            o {tabla: null}: la tabla la crea la llamada (createMap)
//   llamadas: [["insertMap", "gato", 7]] · [["searchMap", "carro"]] · [["createMap", 10]] · [["enlarge"]]
//   salida: {retornos: ["carro"], tabla: [...] ("~": par inválido), size: 6, current: 7 (si no viene, no se revisa)}
export function generarTestTabla(t, retornos, variable = 'map') {
  const e = t.entrada ?? {}, s = t.salida ?? {};
  const lineas = [];
  const creada = Array.isArray(e.tabla);
  if (!creada) lineas.push('ensuciarMemoria();   // memoria con basura: se nota si algo no se inicializa');
  else {
    lineas.push(`char * t[] = {${e.tabla.map(k => k == null ? 'NULL' : cadena(k)).join(', ')}};`);
    lineas.push(`HashMap * ${variable} = tablaCon(${e.tabla.length}, t);`);
    if (Number.isInteger(e.current)) lineas.push(`${variable}->current = ${e.current};`);
  }
  const esperado = [];
  let k = 0;
  for (const [f, ...args] of t.llamadas ?? []) {
    const tipo = retornos.get(f) ?? 'void';
    const as = args.map((a, i) => typeof a === 'string' ? cadena(a) : f === 'insertMap' && i === 1 ? `entero(${a})` : String(a));
    const lista = [creada ? variable : null, ...as].filter(Boolean).join(', ');
    if (/^HashMap \*$/.test(tipo)) lineas.push(`HashMap * ${variable} = ${f}(${as.join(', ')});`);
    else if (tipo === 'void') lineas.push(`${f}(${lista});`);
    else { lineas.push(`retorno(${f}(${lista}));`); esperado.push(`retorna: ${valorTexto(s.retornos?.[k++])}`); }
  }
  const conCurrent = 'current' in s;
  lineas.push(`resultado(${variable}, ${conCurrent ? 1 : 0});`);
  const tabla = s.tabla ?? [];
  esperado.push(`tabla: [${tabla.map(x => x == null ? '-' : valida(x) ? x : '~').join(', ')}]`,
    `size: ${s.size ?? tabla.filter(valida).length}, capacity: ${tabla.length}` + (conCurrent ? `, current: ${s.current}` : ''));
  return { codigo: lineas.join('\n'), esperado: esperado.join('\n') };
}

export function describirTestTabla(t) {
  const e = t.entrada ?? {}, s = t.salida ?? {};
  const tabla = l => `[${(l ?? []).map(x => x == null ? '-' : valida(x) ? x : '~').join(', ')}]`;
  const entrada = !Array.isArray(e.tabla) ? 'sin tabla' : tabla(e.tabla) + (Number.isInteger(e.current) ? `, current = ${e.current}` : '');
  const llamadas = t.llamadas.map(([f, ...a]) => `${f}(${a.map(x => typeof x === 'string' ? `"${x}"` : x).join(', ')})`).join(', ');
  const rets = (s.retornos ?? []).map(valorTexto);
  const salida = (rets.length ? `retorna ${rets.join(', ')}; ` : '') + `queda ${tabla(s.tabla)}, size ${s.size}` + ('current' in s ? `, current = ${s.current}` : '');
  return { entrada, llamadas, salida };
}

// ---------- Estado (como el del volcado) de una tabla dada por sus claves ----------
// tabla: claves (null vacía, "~…" inválido); current: índice o undefined (no se revisa).
export function estadoDeTabla(tabla, current, size) {
  const pares = [], buckets = [];
  let v = 1;
  for (const k of tabla ?? []) {
    if (k == null) { buckets.push(null); continue; }
    buckets.push(pares.length);
    pares.push({ dir: pares.length + 1, key: valida(k) ? { t: k } : null, valor: v++ });
  }
  return { mapa: { dir: 0, size: size ?? (tabla ?? []).filter(valida).length, capacity: (tabla ?? []).length, current, buckets }, pares, vars: [] };
}
export function estadoEntradaTabla(t) {
  const e = t.entrada ?? {};
  return Array.isArray(e.tabla) ? estadoDeTabla(e.tabla, Number.isInteger(e.current) ? e.current : -1) : null;
}
export function estadoSalidaTabla(t) {
  const s = t.salida ?? {};
  const e = estadoDeTabla(s.tabla, 'current' in s ? s.current : undefined, s.size);
  // el par que se espera que retorne, marcado en el dibujo
  const r = s.retornos?.[0];
  if (typeof r === 'string') {
    const i = e.pares.findIndex(p => p.key?.t === r);
    if (i >= 0) e.vars = [{ nombre: 'return', ptr: i }];
  }
  return e;
}
// Lo que se espera, dicho explícitamente: qué retorna (un par, no un texto) y dónde queda current.
export function textoEsperadoTabla(t) {
  const s = t.salida ?? {};
  const partes = (s.retornos ?? []).map(r => r === null ? '↩ retorna NULL' : `↩ retorna el par «${esc(r)}»`);
  if ('current' in s) partes.push(`current = ${esc(s.current)}`);
  return partes.map(p => `<span class="ret">${p}</span>`).join(' ');
}
export const vaciaTabla = estado => !estado?.mapa && !(estado?.pares ?? []).length;

const claveDe = p => p == null ? null : p === '?' ? '?' : p.key == null ? null : p.key === '?' ? '?' : p.key.t;

// ---------- Comparación con lo esperado ----------
export function compararTabla(estado, salida) {
  const M = estado?.mapa, pares = estado?.pares ?? [], esp = salida.tabla ?? [];
  const marcas = { casillas: new Map() }, fallas = [];
  if (!M || typeof M !== 'object') return { marcas, fallas: ['tabla'] };
  const b = Array.isArray(M.buckets) ? M.buckets : [];
  let malas = 0;
  for (let i = 0; i < Math.max(b.length, esp.length); i++) {
    const p = b[i], x = esp[i];
    const obt = p === undefined ? undefined : p === null ? null : p === '?' ? '?' : (pares[p]?.key == null ? '~' : claveDe(pares[p]));
    const quiere = x == null ? null : valida(x) ? x : '~';
    const ok = obt === quiere;
    if (i < b.length) marcas.casillas.set(i, ok ? 'ok' : 'mal');
    if (!ok) malas++;
  }
  if (malas) fallas.push('casillas');
  marcas.capacity = M.capacity === esp.length ? 'ok' : 'mal';
  if (marcas.capacity === 'mal') fallas.push('capacity');
  const size = salida.size ?? esp.filter(valida).length;
  marcas.size = M.size === size ? 'ok' : 'mal';
  if (marcas.size === 'mal') fallas.push('size');
  if ('current' in salida) { marcas.current = M.current === salida.current ? 'ok' : 'mal'; if (marcas.current === 'mal') fallas.push('current'); }
  return { marcas, fallas };
}
export const nombresFallasTabla = { casillas: 'las casillas', size: 'size', capacity: 'capacity', current: 'current', tabla: 'la tabla' };

// ---------- Dibujo ----------
const CL = 74, AH = 40;                 // campos del HashMap
const CW = 64, CH = 34;                 // casillas
const PH = 22;                          // alto de cada fila del Pair
const X0 = 60, YM = 14;

export function svgTabla(estado, nombre, opciones = {}) {
  const M = estado?.mapa, pares = estado?.pares ?? [], vars = estado?.vars ?? [];
  const marcas = opciones.marcas ?? {};
  if ((M === null || M === '?' || !M) && !pares.length) return `<p class="nota">${esc(nombre)} ${M === '?' ? 'apunta a una dirección inválida (basura)' : 'aún no existe (NULL)'}.</p>`;
  const b = M && typeof M === 'object' && Array.isArray(M.buckets) ? M.buckets : [];
  const cap = b.length, POR = opciones.porFila ?? 10;
  // variables enteras que pueden ser un índice (pos, i…): etiqueta sobre su casilla
  const indices = new Map();
  for (const v of vars) if ('valor' in v && Number.isInteger(v.valor) && v.valor >= 0 && v.valor < cap && !/^(size|capacity|return)$/.test(v.nombre) && (!opciones.indices || opciones.indices.has(v.nombre))) {
    if (!indices.has(v.valor)) indices.set(v.valor, []);
    indices.get(v.valor).push(v.nombre);
  }
  // pares apuntados por variables (Pair *)
  const porPar = new Map(), sueltas = [];
  for (const v of vars) {
    if (!('ptr' in v)) continue;
    const n = v.nombre === 'return' ? '↩ retorna' : v.nombre;
    if (Number.isInteger(v.ptr)) { if (!porPar.has(v.ptr)) porPar.set(v.ptr, []); porPar.get(v.ptr).push(n); }
    else sueltas.push(`${n} = ${v.ptr === null ? 'NULL' : '? (basura)'}`);
  }
  const esp = opciones.esperado;   // lo que se espera al final, como anotaciones pequeñas (→ 7, → gato)
  const ARRIBA = indices.size ? 26 : 0;
  const FILA = 16 + ARRIBA + CH + 22 + 2 * PH + (porPar.size ? 34 : 8) + (esp?.casillas?.size ? 14 : 0);
  const YA = YM + AH + 34;              // primera fila del arreglo
  const filas = Math.max(1, Math.ceil(cap / POR));
  const enTabla = new Map();             // par → casilla donde se dibuja
  b.forEach((p, i) => { if (Number.isInteger(p) && !enTabla.has(p)) enTabla.set(p, i); });
  const fuera = pares.map((p, i) => i).filter(i => !enTabla.has(i));
  const yFuera = YA + filas * FILA + 14;
  const enteros = svgEnteros(vars, X0 + 4 * CL + 56, YM);   // contadores, índices, textos… al lado del HashMap
  const ancho = Math.max(X0 + 4 * CL + 64 + enteros.ancho, X0 + 4 * CL + 70, X0 + Math.min(Math.max(cap, 1), POR) * CW + 20, X0 + fuera.length * (CW + 10) + 20);
  const alto = (fuera.length ? yFuera + 18 + 2 * PH + (porPar.size ? 34 : 8) : YA + filas * FILA) + (sueltas.length ? 22 : 0) + 4;
  const s = [];
  const flecha = (d, clase = 'next', marca = '') => s.push(`<path d="${d}" class="flecha ${clase} ${marca}" marker-end="url(#punta-${marca || clase})"/>`);
  const nulo = (x, y, w, h, marca = '') => s.push(`<line x1="${x + 4}" y1="${y + h - 4}" x2="${x + w - 4}" y2="${y + 4}" class="nulo ${marca}"/>`);
  const celdaXY = i => ({ x: X0 + (i % POR) * CW, y: YA + Math.floor(i / POR) * FILA + 16 + ARRIBA });
  // Zonas para tocar: cada parte del dibujo con las expresiones que la nombran (para elegir piezas del asistente)
  const zonas = [];
  const toque = (x, y, w, h, cands) => {
    cands = [...new Set(cands.filter(Boolean))];
    if (cands.length) zonas.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" class="toque" data-expr="${esc(cands.join('|'))}"/>`);
  };
  const conValor = v => vars.filter(x => 'valor' in x && x.valor === v && x.nombre !== 'return').map(x => x.nombre);
  const apuntanA = p => vars.filter(x => x.ptr === p && x.nombre !== 'return').map(x => x.nombre);
  const casillaExprs = i => conValor(i).map(ix => `${nombre}->buckets[${ix}]`);

  // El HashMap
  if (!M || typeof M !== 'object') s.push(`<text x="${X0}" y="${YM + 24}" class="nota-svg">${esc(nombre)} ${M === '?' ? 'es basura' : 'aún no existe (NULL)'}</text>`);
  else {
    s.push(`<text x="${X0 - 8}" y="${YM + 26}" class="nombre" text-anchor="end">${esc(nombre)}</text>`);
    s.push(`<rect x="${X0}" y="${YM}" width="${4 * CL}" height="${AH}" class="lista"/>`);
    ['buckets', 'size', 'capacity', 'current'].forEach((campo, k) => {
      const x = X0 + k * CL, mk = marcas[campo] ?? '';
      if (k) s.push(`<line x1="${x}" y1="${YM}" x2="${x}" y2="${YM + AH}" class="div"/>`);
      s.push(`<text x="${x + CL / 2}" y="${YM + 13}" class="campo">${campo}</text>`);
      if (mk) s.push(`<rect x="${x + 2}" y="${YM + 2}" width="${CL - 4}" height="${AH - 4}" class="celda ${mk}"/>`);
      if (campo === 'buckets') {
        if (M.buckets === null) nulo(x + 14, YM + 16, CL - 28, AH - 20);
        else if (!Array.isArray(M.buckets)) s.push(`<text x="${x + CL / 2}" y="${YM + 33}" class="basura">?</text>`);
        else {
          const ox = x + CL / 2, oy = YM + 28;
          s.push(`<circle cx="${ox}" cy="${oy}" r="3" class="punto"/>`);
          flecha(`M${ox},${oy} C${ox},${oy + 24} ${X0 + 10},${YA - 10} ${X0 + 10},${YA + ARRIBA + 14}`);
        }
      } else {
        const v = M[campo], e = esp?.campos?.[campo];
        s.push(`<text x="${x + CL / 2 - (e !== undefined ? 12 : 0)}" y="${YM + 33}" class="${v === undefined ? 'campo' : 'dato num'}">${v === undefined ? '—' : esc(v)}</text>`);
        if (e !== undefined) s.push(`<text x="${x + CL - 4}" y="${YM + 33}" class="esperado" text-anchor="end">→${esc(e)}</text>`);
      }
    });
    if (!opciones.sinDirecciones && M.dir) s.push(`<text x="${X0 + 4 * CL + 6}" y="${YM + AH - 2}" class="dir" text-anchor="start">${hex(M.dir)}</text>`);
    toque(X0 - 56, YM, 54, AH, [nombre]);
    ['buckets', 'size', 'capacity', 'current'].forEach((campo, k) => toque(X0 + k * CL, YM, CL, AH, [`${nombre}->${campo}`]));
  }

  // Un Pair [key / value] en (x, y)
  const par = (i, x, y, extra = '') => {
    const p = pares[i], w = CW - 8, invalido = p.key == null;
    s.push(`<rect x="${x}" y="${y}" width="${w}" height="${2 * PH}" class="nodo par${invalido ? ' invalido' : ''}${extra}"/>`);
    s.push(`<line x1="${x}" y1="${y + PH}" x2="${x + w}" y2="${y + PH}" class="div"/>`);
    const k = claveDe(p);
    s.push(k === '?' ? `<text x="${x + w / 2}" y="${y + 16}" class="basura">?</text>`
      : `<text x="${x + w / 2}" y="${y + 16}" class="clave${invalido ? ' nula' : ''}">${k == null ? 'NULL' : esc(k.length > 7 ? k.slice(0, 6) + '…' : k)}</text>`);
    s.push(`<text x="${x + w / 2}" y="${y + PH + 16}" class="valor">${p.valor === '?' ? '?' : p.valor === null ? 'NULL' : esc(p.valor)}</text>`);
    const base = [...apuntanA(i), ...(enTabla.has(i) ? casillaExprs(enTabla.get(i)) : [])];
    toque(x, y, w, PH, [...base.map(c => `${c}->key`), ...base]);
    toque(x, y + PH, w, PH, [...base.map(c => `${c}->value`), ...base]);
    const ns = porPar.get(i);
    if (ns) {
      const cx = x + w / 2, ty = y + 2 * PH + 18, wt = Math.max(30, ns.join(', ').length * 8 + 12);
      s.push(`<path d="M${cx},${ty - 4} L${cx},${y + 2 * PH + 4}" class="flecha var" marker-end="url(#punta-var)"/>`);
      s.push(`<rect x="${cx - wt / 2}" y="${ty - 4}" width="${wt}" height="20" rx="3" class="etiqueta${ns.some(n => n.startsWith('↩')) ? ' retorno' : ''}"/>`);
      s.push(`<text x="${cx}" y="${ty + 10}" class="var">${esc(ns.join(', '))}</text>`);
      toque(cx - wt / 2, ty - 4, wt, 20, apuntanA(i));
    }
  };

  // El arreglo buckets
  b.forEach((p, i) => {
    const { x, y } = celdaXY(i), mk = marcas.casillas?.get(i) ?? '';
    const esCurrent = M?.current === i;
    s.push(`<text x="${x + CW / 2}" y="${y - 4}" class="indice${esCurrent ? ' current' : ''}">${i}</text>`);
    s.push(`<rect x="${x}" y="${y}" width="${CW}" height="${CH}" class="casilla${esCurrent ? ' es-current' : ''}"/>`);
    if (mk) s.push(`<rect x="${x + 2}" y="${y + 2}" width="${CW - 4}" height="${CH - 4}" class="celda ${mk}"/>`);
    const ns = indices.get(i);
    if (ns) {
      const t = ns.join(', '), wt = Math.max(26, t.length * 8 + 10), ty = y - 16 - 22;
      s.push(`<rect x="${x + CW / 2 - wt / 2}" y="${ty}" width="${wt}" height="18" rx="3" class="etiqueta"/>`);
      s.push(`<text x="${x + CW / 2}" y="${ty + 13}" class="var">${esc(t)}</text>`);
      toque(x + CW / 2 - wt / 2, ty, wt, 18, ns);
    }
    toque(x, y, CW, CH, [...(Number.isInteger(p) ? apuntanA(p) : []), ...casillaExprs(i)]);
    const e = esp?.casillas?.get(i);
    if (e !== undefined) s.push(`<text x="${x + CW / 2}" y="${Number.isInteger(p) ? y + CH + 22 + 2 * PH + (porPar.has(p) ? 34 : 0) + 12 : y + CH + 14}" class="esperado" text-anchor="middle">→ ${esc(e.length > 8 ? e.slice(0, 7) + '…' : e)}</text>`);
    if (p === null) nulo(x + 16, y + 6, CW - 32, CH - 12, mk);
    else if (p === '?') s.push(`<text x="${x + CW / 2}" y="${y + CH / 2 + 6}" class="basura">?</text>`);
    else {
      const ox = x + CW / 2, oy = y + CH / 2;
      s.push(`<circle cx="${ox}" cy="${oy}" r="3" class="punto"/>`);
      const j = enTabla.get(p);
      if (j === i) {
        flecha(`M${ox},${oy} L${ox},${y + CH + 20}`);
        par(p, x + 4, y + CH + 22, mk ? ' ' + mk : '');
      } else {   // el mismo par en otra casilla: flecha hacia allá
        const t = celdaXY(j);
        flecha(`M${ox},${oy} C${ox},${y + CH + 30} ${t.x + CW / 2 + 8},${t.y + CH + 4} ${t.x + CW / 2 + 8},${t.y + CH + 21}`);
      }
    }
  });
  if (M && typeof M === 'object' && !cap) s.push(`<text x="${X0}" y="${YA + 30}" class="nota-svg">${M.buckets === null ? 'buckets es NULL' : M.buckets === '?' ? 'buckets (o capacity) tiene basura' : '(sin casillas)'}</text>`);

  // Pares que no están en la tabla (por ejemplo, los del arreglo antiguo durante enlarge)
  if (fuera.length) {
    s.push(`<text x="${X0}" y="${yFuera}" class="nota-svg">fuera de la tabla:</text>`);
    fuera.forEach((i, k) => par(i, X0 + k * (CW + 10), yFuera + 8, ' fuera'));
  }
  if (sueltas.length) s.push(`<text x="${X0}" y="${alto - 8}" class="nota-svg">${esc(sueltas.join('   '))}</text>`);
  if (esp?.retornoNulo) s.push(`<text x="${X0 + 4 * CL + 8}" y="${YM + AH + 14}" class="esperado">↩ NULL</text>`);
  s.push(enteros.svg, ...zonas);

  const marca = c => `<marker id="punta-${c}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="punta ${c}"/></marker>`;
  return `<svg class="memoria tabla-hash" viewBox="0 0 ${ancho} ${alto}" style="max-width:${Math.round(ancho * (opciones.escala ?? 0.62))}px" role="img" aria-label="Memoria de la tabla hash">
<defs>${['next', 'var', 'ok', 'mal'].map(marca).join('')}</defs>${s.join('')}</svg>`;
}

// ---------- Diagnóstico de un error en una línea ----------
// Sigue expresiones como «map->buckets[pos]->key» en el estado; si alguna parte es NULL o basura
// antes de un «->», lo explica.
export function diagnosticarTabla(linea, estado, nombreMapa) {
  if (!estado) return null;
  const M = estado.mapa, pares = estado.pares ?? [], vars = estado.vars ?? [];
  const entero = ex => {
    ex = ex.trim();
    if (/^-?\d+$/.test(ex)) return +ex;
    const v = vars.find(x => x.nombre === ex && 'valor' in x);
    return v ? v.valor : undefined;
  };
  const valorVar = n => {
    if (n === nombreMapa) return M === null ? null : M === '?' ? '?' : { mapa: true };
    const v = vars.find(x => x.nombre === n);
    return v && 'ptr' in v ? (Number.isInteger(v.ptr) ? { par: v.ptr } : v.ptr) : undefined;
  };
  const sinTextos = linea.replace(/"(?:\\.|[^"\\])*"/g, '""').replace(/\/\/.*$/, '');
  for (const m of sinTextos.matchAll(/\b([A-Za-z_]\w*)((?:\s*->\s*[A-Za-z_]\w*|\s*\[[^\[\]]*\])+)/g)) {
    let val = valorVar(m[1]), texto = m[1], casilla = '';
    if (val === undefined) continue;
    for (const seg of m[2].match(/->\s*[A-Za-z_]\w*|\[[^\[\]]*\]/g)) {
      if (seg.startsWith('->')) {
        const campo = seg.slice(2).trim();
        if (val === null) return `<code>${esc(texto)}</code>${casilla} es NULL, y la línea hace <code>${esc(texto)}->${esc(campo)}</code> (no se puede seguir un puntero NULL).`;
        if (val === '?') return `<code>${esc(texto)}</code> tiene basura (no se inicializó o apunta a memoria inválida), y la línea hace <code>${esc(texto)}->${esc(campo)}</code>.`;
        if (val?.mapa) val = campo === 'buckets' ? (M.buckets === null ? null : Array.isArray(M.buckets) ? { arreglo: M.buckets } : '?') : undefined;
        else val = undefined;   // campos de un par (key, value): no se siguen
        texto += '->' + campo;
      } else {
        const ix = entero(seg.slice(1, -1)), ixTxt = seg.slice(1, -1).trim();
        if (val?.arreglo) {
          if (ix !== undefined && (ix < 0 || ix >= val.arreglo.length)) return `el índice <code>${esc(ixTxt)}</code> vale ${ix}, fuera del arreglo (0 a ${val.arreglo.length - 1}). ¿Falta <code>% map->capacity</code>?`;
          const p = ix === undefined ? undefined : val.arreglo[ix];
          texto += `[${ixTxt}]`;
          val = p === undefined ? undefined : p === null ? null : p === '?' ? '?' : { par: p };
          casilla = ix !== undefined ? ` (la casilla ${ix})` : '';
        } else { val = undefined; texto += seg; }
      }
      if (val === undefined) break;
    }
  }
  return null;
}

// Variables que no son punteros a pares (enteros, textos, valores) y lo que retorna la función.
export function htmlVariablesTabla(estado) {
  const vars = estado?.vars ?? [];
  const valor = v => 'valor' in v ? String(v.valor)
    : 'texto' in v ? (v.texto === null ? 'NULL' : v.texto === '?' ? '? (basura)' : `"${v.texto.t}"`)
    : 'dato' in v ? (v.dato === null ? 'NULL' : v.dato === '?' ? '? (basura)' : `→ ${v.dato}`)
    : v.ptr === null ? 'NULL' : v.ptr === '?' ? '? (basura)' : `→ par ${claveDe(estado.pares?.[v.ptr]) ?? 'NULL'}`;
  const ret = vars.find(v => v.nombre === 'return');
  const otras = vars.filter(v => v.nombre !== 'return' && !('ptr' in v));
  let h = '';
  if (ret) {
    const que = 'ptr' in ret && Number.isInteger(ret.ptr) ? `el par <b>${esc(claveDe(estado.pares?.[ret.ptr]) ?? '(clave NULL)')}</b>` : `<b>${esc(valor(ret))}</b>`;
    h += `<p class="retorno">↩ retorna ${que}</p>`;
  }
  if (otras.length) h += `<table class="tabla-vars"><tr><th>variable</th><th>valor</th></tr>${otras.map(v =>
    `<tr><td><code>${esc(v.nombre)}</code></td><td><code>${esc(valor(v))}</code></td></tr>`).join('')}</table>`;
  return h;
}

// Lo que se espera al final de un test, como anotaciones sobre el dibujo de la entrada: el valor final
// de size, capacity y current (si cambia), qué queda en cada casilla que cambia y qué par retorna.
export function esperadoTabla(estado, salida) {
  const M = estado?.mapa, pares = estado?.pares ?? [], esp = salida.tabla ?? [];
  const campos = {}, casillas = new Map();
  const ok = M && typeof M === 'object';
  const size = salida.size ?? esp.filter(valida).length;
  if (!ok || M.size !== size) campos.size = size;
  if (!ok || M.capacity !== esp.length) campos.capacity = esp.length;
  if ('current' in salida && (!ok || M.current !== salida.current)) campos.current = salida.current;
  const b = ok && Array.isArray(M.buckets) ? M.buckets : [];
  if (b.length === esp.length) b.forEach((p, i) => {   // (si cambia la capacidad, basta con «capacity →»)
    const ahora = p === null ? null : Number.isInteger(p) ? (pares[p]?.key == null ? '~' : claveDe(pares[p])) : '?';
    const quiere = esp[i] == null ? null : valida(esp[i]) ? esp[i] : '~';
    if (ahora !== quiere) casillas.set(i, quiere === null ? '-' : quiere === '~' ? 'key NULL' : quiere);
  });
  const r = salida.retornos?.[0];
  const retorno = typeof r === 'string' ? pares.findIndex(p => claveDe(p) === r) : -1;
  return { campos, casillas, retorno, retornoNulo: (salida.retornos ?? []).length > 0 && r === null };
}
