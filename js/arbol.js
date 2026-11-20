// Modelo «árbol binario de búsqueda» (Lab 4): tests declarativos y dibujo estático de un TreeMap.
// Cada nodo es una caja [clave / left | right] en la columna de su clave (de menor a mayor, fija durante
// toda la ejecución) y en la fila de su profundidad; los que no cuelgan de root van abajo, aparte.
import { svgEnteros } from './visual.js?v=202611201332';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const hex = d => '0x' + (Number(d) % 0x10000).toString(16).padStart(3, '0');
const valorTexto = v => v === null || v === undefined ? 'NULL' : String(v);

// Las palabras (valores) de cada clave en los tests, como en el enunciado del lab.
const PALABRAS = { 5239: 'auto', 8213: 'rayo', 6980: 'hoja', 1273: 'reto', 900: 'luz', 100: 'sol', 2000: 'mar', 7000: 'pan', 50: 'uno', 3000: 'ola', 9000: 'faro' };
export const palabraDe = k => PALABRAS[k] ?? `p${k}`;

// ---------- Árboles como datos ----------
// Un árbol se da por sus claves en preorden (insertarlas en ese orden arma el mismo árbol).
export function arbolDesde(claves) {
  let raiz = null;
  for (const k of claves ?? []) {
    const n = { k, l: null, r: null };
    if (!raiz) { raiz = n; continue; }
    let x = raiz;
    for (;;) {
      if (k < x.k) { if (x.l) x = x.l; else { x.l = n; break; } }
      else { if (x.r) x = x.r; else { x.r = n; break; } }
    }
  }
  return raiz;
}
// «5239(1273, 8213(6980, -))»: como lo imprime resultado() de ayudas.c
export function textoArbol(n) {
  if (!n) return '-';
  if (!n.l && !n.r) return String(n.k);
  return `${n.k}(${textoArbol(n.l)}, ${textoArbol(n.r)})`;
}

// ---------- Tests declarativos ----------
//   entrada: {arbol: [5239, 1273, 8213, 6980] (preorden; [] vacío; null: lo crea createTreeMap), current: 6980 (clave)}
//   llamadas: [["searchTreeMap", 8213]] · [["insertTreeMap", 900]] · [["minimum", "root->left"]] · [["createTreeMap"]]
//   salida: {retornos: [6980 o null], arbol: [preorden final], current: clave o null (si no viene, no se revisa)}
export function generarTestArbol(t, retornos, variable = 'tree') {
  const e = t.entrada ?? {}, s = t.salida ?? {};
  const lineas = [];
  const creado = Array.isArray(e.arbol);
  if (!creado) lineas.push('ensuciarMemoria();   // memoria con basura: se nota si algo no se inicializa');
  else if (!e.arbol.length) lineas.push(`TreeMap * ${variable} = arbolCon(0, NULL, NULL);   // árbol vacío`);
  else {
    lineas.push(`int claves[] = {${e.arbol.join(', ')}};`, `char * palabras[] = {${e.arbol.map(k => `"${palabraDe(k)}"`).join(', ')}};`);
    lineas.push(`TreeMap * ${variable} = arbolCon(${e.arbol.length}, claves, palabras);`);
  }
  if (Number.isInteger(e.current)) lineas.push(`${variable}->current = nodoCon(${variable}, ${e.current});`);
  const esperado = [];
  let k = 0;
  for (const [f, ...args] of t.llamadas ?? []) {
    const tipo = f === 'createTreeMap' ? 'TreeMap *' : retornos.get(f) ?? 'void';   // (su prototipo tiene un puntero a función)
    let llamada;
    if (f === 'createTreeMap') llamada = `${f}(lower_than_int)`;
    else if (typeof args[0] === 'string') llamada = `${f}(${variable}->${args[0]})`;   // un nodo: minimum(tree->root)
    else llamada = `${f}(${[variable, ...args.map((a, i) => i === 0 ? `entero(${a})` : a)].join(', ')}${f === 'insertTreeMap' ? `, texto("${palabraDe(args[0])}")` : ''})`;
    if (/^TreeMap \*$/.test(tipo)) lineas.push(`TreeMap * ${variable} = ${llamada};`);
    else if (tipo === 'void') lineas.push(`${llamada};`);
    else {
      lineas.push(`${/TreeNode/.test(tipo) ? 'retornoNodo' : 'retorno'}(${llamada});`);
      esperado.push(`retorna: ${valorTexto(s.retornos?.[k++])}`);
    }
  }
  const conCurrent = 'current' in s;
  lineas.push(`resultado(${variable}, ${conCurrent ? 1 : 0});`);
  const raiz = arbolDesde(s.arbol);
  esperado.push(`arbol: ${raiz ? textoArbol(raiz) : '(vacío)'}`, 'padres: bien', 'lower_than: bien');
  if (conCurrent) esperado.push(`current: ${valorTexto(s.current)}`);
  return { codigo: lineas.join('\n'), esperado: esperado.join('\n') };
}

export function describirTestArbol(t) {
  const e = t.entrada ?? {}, s = t.salida ?? {};
  const arbol = l => { const r = arbolDesde(l); return r ? textoArbol(r) : '(vacío)'; };
  const entrada = !Array.isArray(e.arbol) ? 'sin árbol' : arbol(e.arbol) + (Number.isInteger(e.current) ? `, current en ${e.current}` : '');
  const llamadas = t.llamadas.map(([f, ...a]) => `${f}(${a.map(x => typeof x === 'string' ? `tree->${x}` : x).join(', ')})`).join(', ');
  const rets = (s.retornos ?? []).map(valorTexto);
  const salida = (rets.length ? `retorna ${rets.join(', ')}; ` : '') + `queda ${arbol(s.arbol)}` + ('current' in s ? `, current en ${valorTexto(s.current)}` : '');
  return { entrada, llamadas, salida };
}

// ---------- Estado (como el del volcado) de un árbol dado por sus claves ----------
export function estadoDeArbol(claves, current) {
  const nodos = [];
  const agregar = (n, padre) => {
    if (!n) return null;
    const i = nodos.length;
    nodos.push({ dir: i + 1, par: 1000 + i, clave: n.k, valor: { t: palabraDe(n.k) }, left: null, right: null, parent: padre });
    nodos[i].left = agregar(n.l, i);
    nodos[i].right = agregar(n.r, i);
    return i;
  };
  const root = agregar(arbolDesde(claves), null);
  const cur = current === undefined ? undefined : current === null ? null : nodos.findIndex(n => n.clave === current);
  return { arbol: { dir: 0, root, current: cur === -1 ? null : cur, lt: 1 }, nodos, vars: [] };
}
export function estadoEntradaArbol(t) {
  const e = t.entrada ?? {};
  return Array.isArray(e.arbol) ? estadoDeArbol(e.arbol, Number.isInteger(e.current) ? e.current : null) : null;
}
export function estadoSalidaArbol(t) {
  const s = t.salida ?? {};
  const e = estadoDeArbol(s.arbol, 'current' in s ? s.current : undefined);
  const r = s.retornos?.[0];
  if (Number.isInteger(r)) { const i = e.nodos.findIndex(n => n.clave === r); if (i >= 0) e.vars = [{ nombre: 'return', ptr: i }]; }
  return e;
}
export const vacioArbol = estado => !estado?.arbol && !(estado?.nodos ?? []).length;
export function textoEsperadoArbol(t) {
  const s = t.salida ?? {};
  const partes = (s.retornos ?? []).map(r => r === null ? '↩ retorna NULL' : `↩ retorna ${/minimum/.test(t.llamadas?.[0]?.[0] ?? '') ? 'el nodo' : 'el par'} ${esc(r)}`);
  if ('current' in s) partes.push(`current = ${esc(valorTexto(s.current))}`);
  return partes.map(p => `<span class="ret">${p}</span>`).join(' ');
}

// Columnas fijas: todas las claves que aparecen en la ejecución, de menor a mayor.
export function lugaresArbol(estados) {
  const ks = new Set();
  for (const e of estados) for (const n of e?.nodos ?? []) if (Number.isInteger(n.clave)) ks.add(n.clave);
  return new Map([...ks].sort((a, b) => a - b).map((k, i) => [k, i]));
}

// ---------- Comparación con lo esperado ----------
export function compararArbol(estado, salida) {
  const A = estado?.arbol, ns = estado?.nodos ?? [];
  const marcas = { nodos: new Map(), padres: new Set() }, fallas = [];
  if (!A || typeof A !== 'object') return { marcas, fallas: ['arbol'] };
  let malas = 0;
  const visitar = (i, esp, padre, prof) => {
    if (prof > 40) return;
    if (i === null || i === undefined) { if (esp) malas++; return; }
    if (!Number.isInteger(i)) { malas++; return; }
    const n = ns[i];
    const ok = !!esp && n.clave === esp.k;
    marcas.nodos.set(i, ok ? 'ok' : 'mal');
    if (!ok) malas++;
    if (n.parent !== padre) marcas.padres.add(i);
    visitar(n.left, esp?.l, i, prof + 1);
    visitar(n.right, esp?.r, i, prof + 1);
  };
  visitar(A.root, arbolDesde(salida.arbol), null, 0);
  if (malas) fallas.push('nodos');
  if (marcas.padres.size) fallas.push('padres');
  marcas.root = (A.root === null) === !(salida.arbol ?? []).length ? 'ok' : 'mal';
  if ('current' in salida) {
    const c = Number.isInteger(A.current) ? ns[A.current]?.clave : null;
    marcas.current = c === salida.current ? 'ok' : 'mal';
    if (marcas.current === 'mal') fallas.push('current');
  }
  if (A.lt !== 1) { marcas.lt = 'mal'; fallas.push('lower_than'); }
  return { marcas, fallas };
}
export const nombresFallasArbol = { nodos: 'los nodos del árbol', padres: 'los parent', current: 'current', lower_than: 'lower_than', arbol: 'el árbol' };

// Lo que se espera al final, como anotaciones sobre el dibujo de la entrada.
export function esperadoArbol(estado, salida) {
  const A = estado?.arbol, ns = estado?.nodos ?? [];
  const campos = {};
  if ('current' in salida) {
    const c = A && Number.isInteger(A.current) ? ns[A.current]?.clave : null;
    if (c !== salida.current) campos.current = valorTexto(salida.current);
  }
  // ¿cambia la forma del árbol? → «→ 5239(1273, …)» abajo
  const raizActual = (() => {
    const conv = (i, prof) => !Number.isInteger(i) || prof > 40 ? null : { k: ns[i].clave, l: conv(ns[i].left, prof + 1), r: conv(ns[i].right, prof + 1) };
    return A && typeof A === 'object' ? conv(A.root, 0) : null;
  })();
  const final = arbolDesde(salida.arbol);
  const texto = textoArbol(raizActual) !== textoArbol(final) ? `→ queda ${final ? textoArbol(final) : '(vacío)'}` : '';
  const r = salida.retornos?.[0];
  const retorno = Number.isInteger(r) ? ns.findIndex(n => n.clave === r) : -1;
  return { campos, texto, retorno, retornoNulo: (salida.retornos ?? []).length > 0 && r === null };
}

// ---------- Dibujo ----------
// El TreeMap va a la izquierda, en columna (root, current, lower_than), con las variables debajo;
// el árbol, a su derecha, parte bien arriba.
const XL = 6, CW = 108, FH = 30;        // columna izquierda: ancho y alto de cada campo
const NW = 66, KH = 28, PH = 18;        // nodo: clave arriba, left | right abajo
const NH = KH + PH;
const CS = 74, LH = 74;                 // separación entre columnas y entre niveles
const YM = 8, X0 = XL + CW + 34;        // X0: donde empieza el árbol

export function svgArbol(estado, nombre, opciones = {}) {
  const A = estado?.arbol, ns = estado?.nodos ?? [], vars = estado?.vars ?? [];
  const marcas = opciones.marcas ?? {}, esp = opciones.esperado;
  if ((A === null || A === '?' || !A) && !ns.length) return `<p class="nota">${esc(nombre)} ${A === '?' ? 'apunta a una dirección inválida (basura)' : 'aún no existe (NULL)'}.</p>`;
  const ok = A && typeof A === 'object';
  // profundidad de cada nodo que cuelga de root
  const prof = new Map(), padreReal = new Map();
  const bajar = (i, p, padre) => { if (!Number.isInteger(i) || prof.has(i) || p > 30) return; prof.set(i, p); padreReal.set(i, padre); bajar(ns[i].left, p + 1, i); bajar(ns[i].right, p + 1, i); };
  if (ok) bajar(A.root, 0, null);
  const lugares = opciones.lugares instanceof Map && opciones.lugares.size ? opciones.lugares : lugaresArbol([estado]);
  let extra = lugares.size;
  const col = new Map();
  ns.forEach((n, i) => col.set(i, Number.isInteger(n.clave) && lugares.has(n.clave) ? lugares.get(n.clave) : extra++));
  const niveles = Math.max(0, ...[...prof.values()].map(p => p + 1));
  const fuera = ns.map((n, i) => i).filter(i => !prof.has(i));
  // variables que apuntan a nodos (TreeNode *) o a pares (Pair *: al nodo que tiene ese par)
  const porNodo = new Map(), sueltas = [];
  for (const v of vars) {
    const n = v.nombre === 'return' ? '↩ retorna' : v.nombre;
    let i = null;
    if ('ptr' in v) i = v.ptr;
    else if ('par' in v) i = v.par === null ? null : Number.isInteger(v.par) ? ns.findIndex(x => x.par === v.par) : '?';
    else continue;
    if (Number.isInteger(i) && i >= 0) { if (!porNodo.has(i)) porNodo.set(i, []); porNodo.get(i).push('par' in v ? `${n} (par)` : n); }
    else sueltas.push(`${n} = ${i === null ? 'NULL' : '?'}`);
  }
  const BAJO = 14 + (porNodo.size ? 26 : 0);
  const YA = YM + 8;                     // la raíz, arriba
  const yNivel = p => YA + p * LH;
  const yFuera = YA + Math.max(1, niveles) * LH + 4;
  const pos = new Map();
  ns.forEach((n, i) => pos.set(i, { x: X0 + col.get(i) * CS, y: prof.has(i) ? yNivel(prof.get(i)) : yFuera + 16 }));
  const YC = YM + 18;                    // los campos del TreeMap (debajo de su nombre)
  const enteros = svgEnteros(vars.filter(v => !('par' in v)), XL, YC + 3 * FH + 12, CW);
  const altoIzq = YC + 3 * FH + 12 + enteros.alto + (esp?.retornoNulo ? 18 : 0);
  const ancho = Math.max(X0 + Math.max(extra, 1) * CS + 8, X0 + 120);   // (que quepa «(árbol vacío)»)
  const alto = Math.max(altoIzq, (fuera.length ? yFuera + 16 + NH + BAJO : yNivel(Math.max(niveles, 1) - 1) + NH + BAJO + 4)) + (sueltas.length ? 20 : 0) + (esp?.texto ? 20 : 0);
  const s = [], zonas = [];
  const flecha = (d, clase = 'next', marca = '') => s.push(`<path d="${d}" class="flecha ${clase} ${marca}" marker-end="url(#punta-${marca || clase})"/>`);
  const nulo = (x, y, w, h, marca = '') => s.push(`<line x1="${x + 4}" y1="${y + h - 3}" x2="${x + w - 4}" y2="${y + 3}" class="nulo ${marca}"/>`);
  const toque = (x, y, w, h, cands) => {
    cands = [...new Set(cands.filter(Boolean))];
    while (cands[0] === '¦') cands.shift();
    while (cands.at(-1) === '¦') cands.pop();
    if (cands.length) zonas.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" class="toque" data-expr="${esc(cands.join('|'))}"/>`);
  };
  const llega = (i, x, y, clase, marca = '') => {   // flecha desde (x, y) hasta arriba del nodo i
    const p = pos.get(i);
    if (!p) return;
    flecha(`M${x},${y} C${x},${y + 26} ${p.x + NW / 2},${p.y - 26} ${p.x + NW / 2},${p.y - 1}`, clase, marca);
  };
  const deCampo = (i, x, y, clase, marca = '') => {   // desde un campo del TreeMap (a la izquierda): sale hacia la derecha
    const p = pos.get(i);
    if (!p) return;
    flecha(`M${x},${y} C${x + 40},${y} ${p.x + NW / 2},${p.y - 34} ${p.x + NW / 2},${p.y - 1}`, clase, marca);
  };

  // El TreeMap, en columna a la izquierda
  if (!ok) s.push(`<text x="${XL}" y="${YM + 30}" class="nota-svg">${esc(nombre)} ${A === '?' ? 'es basura' : 'es NULL'}</text>`);
  else {
    s.push(`<text x="${XL}" y="${YM + 12}" class="nombre">${esc(nombre)}</text>`);
    if (!opciones.sinDirecciones && A.dir) s.push(`<text x="${XL + CW}" y="${YM + 12}" class="dir" text-anchor="end">${hex(A.dir)}</text>`);
    s.push(`<rect x="${XL}" y="${YC}" width="${CW}" height="${3 * FH}" class="lista"/>`);
    ['root', 'current', 'lower_than'].forEach((campo, k) => {
      const y = YC + k * FH, mk = marcas[campo === 'lower_than' ? 'lt' : campo] ?? '';
      if (k) s.push(`<line x1="${XL}" y1="${y}" x2="${XL + CW}" y2="${y}" class="div"/>`);
      s.push(`<text x="${XL + 38}" y="${y + 19}" class="campo">${campo}</text>`);
      if (mk) s.push(`<rect x="${XL + 2}" y="${y + 2}" width="${CW - 4}" height="${FH - 4}" class="celda ${mk}"/>`);
      const cx = XL + CW - 15, cy = y + FH / 2;   // donde está el valor (a la derecha del campo)
      if (campo === 'lower_than') s.push(`<text x="${cx}" y="${cy + 5}" class="${A.lt === 1 ? 'campo' : 'basura'}">${A.lt === 1 ? 'f()' : A.lt === 0 ? 'NULL' : '?'}</text>`);
      else {
        const v = A[campo];
        if (v === undefined) s.push(`<text x="${cx}" y="${cy + 5}" class="campo">—</text>`);
        else if (v === null) nulo(cx - 12, y + 6, 24, FH - 12, mk);
        else if (v === '?') s.push(`<text x="${cx}" y="${cy + 6}" class="basura">?</text>`);
        else { s.push(`<circle cx="${cx}" cy="${cy}" r="3" class="punto ${campo === 'root' ? 'head' : 'current'}"/>`); deCampo(v, cx, cy, campo === 'root' ? 'head' : 'current', mk); }
        if (esp?.campos && campo in esp.campos) s.push(`<text x="${XL + CW + 4}" y="${cy + 4}" class="esperado">→${esc(esp.campos[campo])}</text>`);
      }
    });
  }
  if (fuera.length) s.push(`<text x="${X0}" y="${yFuera + 8}" class="nota-svg">fuera del árbol (no cuelgan de root):</text>`);

  // expresiones que llegan a cada nodo (para tocar el dibujo y elegir piezas)
  const nombresDe = new Map();
  const agregar = (i, e) => { if (!Number.isInteger(i)) return; if (!nombresDe.has(i)) nombresDe.set(i, []); nombresDe.get(i).push(e); };
  for (const v of vars) if (Number.isInteger(v.ptr) && v.nombre !== 'return') agregar(v.ptr, v.nombre);
  if (ok) { agregar(A.root, `${nombre}->root`); agregar(A.current, `${nombre}->current`); }
  for (const [i, es] of [...nombresDe]) for (const e of [...es]) { agregar(ns[i]?.left, `${e}->left`); agregar(ns[i]?.right, `${e}->right`); agregar(ns[i]?.parent, `${e}->parent`); }

  // las formas de nombrar a lo que apunta un puntero (las variables primero)
  const alias = (i, expr) => { const xs = nombresDe.get(i) ?? []; return [...xs.filter(x => /^\w+$/.test(x)), expr, ...xs.filter(x => !/^\w+$/.test(x) && x !== expr)]; };
  // Los nodos
  ns.forEach((n, i) => {
    const { x, y } = pos.get(i), mk = marcas.nodos?.get(i) ?? '';
    s.push(`<rect x="${x}" y="${y}" width="${NW}" height="${NH}" class="nodo${prof.has(i) ? '' : ' fuera'} ${mk}"/>`);
    s.push(`<line x1="${x}" y1="${y + KH}" x2="${x + NW}" y2="${y + KH}" class="div"/>`);
    s.push(`<line x1="${x + NW / 2}" y1="${y + KH}" x2="${x + NW / 2}" y2="${y + NH}" class="div"/>`);
    s.push(n.clave === '?' || n.par === '?' ? `<text x="${x + NW / 2}" y="${y + 20}" class="basura">?</text>`
      : `<text x="${x + NW / 2}" y="${y + 20}" class="clave clave-arbol">${n.par === null ? 'pair NULL' : esc(n.clave)}</text>`);
    const palabra = n.valor && typeof n.valor === 'object' ? n.valor.t : '';
    if (palabra) s.push(`<text x="${x + NW / 2}" y="${y + NH + 11}" class="valor">${esc(palabra)}</text>`);
    // left y right
    [['left', x, x + NW / 4], ['right', x + NW / 2, x + 3 * NW / 4]].forEach(([c, cx, ox]) => {
      const v = n[c], oy = y + KH + PH / 2;
      if (v === null) nulo(cx, y + KH, NW / 2, PH);
      else if (v === '?') s.push(`<text x="${ox}" y="${oy + 5}" class="basura">?</text>`);
      else { s.push(`<circle cx="${ox}" cy="${oy}" r="2.5" class="punto"/>`); llega(v, ox, oy, c === 'left' ? 'next' : 'next'); }
    });
    // parent: solo se dibuja si está mal (no apunta a su padre de verdad), en rojo; si está bien, no recarga el dibujo
    const malo = prof.has(i) && n.parent !== padreReal.get(i);
    if (malo && Number.isInteger(n.parent) && pos.get(n.parent)) {
      const p = pos.get(n.parent);
      s.push(`<path d="M${x + 6},${y} C${x + 6},${y - 26} ${p.x + NW / 2 + (p.x < x ? 14 : -14)},${p.y + NH + 24} ${p.x + NW / 2 + (p.x < x ? 14 : -14)},${p.y + NH + 1}" class="flecha parent${malo ? ' mal' : ''}" marker-end="url(#punta-${malo ? 'mal' : 'parent'})"/>`);
    } else if (malo) s.push(`<text x="${x}" y="${y - 4}" class="nota-svg mal-texto">parent = ${n.parent === null ? 'NULL' : '?'} ✗</text>`);
    const es = nombresDe.get(i) ?? [];
    // el nodo (todas sus formas); de respaldo, su par o su clave (si el hueco pide eso)
    toque(x, y, NW, KH, [...es, '¦', ...es.map(e => `${e}->pair`), ...es.map(e => `${e}->pair->key`)]);
    toque(x, y + KH, NW / 2, PH, [...(es.length ? alias(n.left, `${es[0]}->left`) : []), '¦', ...es]);
    toque(x + NW / 2, y + KH, NW / 2, PH, [...(es.length ? alias(n.right, `${es[0]}->right`) : []), '¦', ...es]);
  });
  // etiquetas de variables bajo su nodo
  for (const [i, nombres] of porNodo) {
    const { x, y } = pos.get(i), cx = x + NW / 2, ty = y + NH + 26, w = Math.max(30, nombres.join(', ').length * 7.5 + 12);
    s.push(`<path d="M${cx},${ty - 4} L${cx},${y + NH + 14}" class="flecha var" marker-end="url(#punta-var)"/>`);
    s.push(`<rect x="${cx - w / 2}" y="${ty - 4}" width="${w}" height="18" rx="3" class="etiqueta${nombres.some(n => n.startsWith('↩')) ? ' retorno' : ''}"/>`);
    s.push(`<text x="${cx}" y="${ty + 9}" class="var">${esc(nombres.join(', '))}</text>`);
    toque(cx - w / 2, ty - 4, w, 18, nombres.filter(n => !n.startsWith('↩')).map(n => n.replace(/ \(par\)$/, '')));
  }
  if (ok) {
    toque(XL, YM, CW, 16, [nombre]);
    ['root', 'current'].forEach((c, k) => toque(XL, YC + k * FH, CW, FH, alias(A[c], `${nombre}->${c}`)));
  }
  if (sueltas.length) s.push(`<text x="${XL}" y="${alto - 8 - (esp?.texto ? 20 : 0)}" class="nota-svg">${esc(sueltas.join('   '))}</text>`);
  if (esp?.texto) s.push(`<text x="${XL}" y="${alto - 8}" class="esperado">${esc(esp.texto)}</text>`);
  if (esp?.retornoNulo) s.push(`<text x="${XL}" y="${altoIzq - 4}" class="esperado">↩ NULL</text>`);
  if (ok && A.root === null && !ns.length) s.push(`<text x="${X0}" y="${YA + 16}" class="nota-svg">(árbol vacío)</text>`);
  s.push(enteros.svg, ...zonas);

  const marca = c => `<marker id="punta-${c}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="punta ${c}"/></marker>`;
  return `<svg class="memoria arbol" viewBox="0 0 ${ancho} ${alto}" style="max-width:${Math.round(ancho * (opciones.escala ?? 0.62))}px" role="img" aria-label="Memoria del árbol">
<defs>${['head', 'current', 'next', 'parent', 'var', 'ok', 'mal'].map(marca).join('')}</defs>${s.join('')}</svg>`;
}

// ---------- Diagnóstico de un error en una línea ----------
// Sigue expresiones como «tree->root->left->pair->key»; si alguna parte vale NULL o basura antes de un «->», lo explica.
export function diagnosticarArbol(linea, estado, nombreArbol) {
  if (!estado) return null;
  const A = estado.arbol, ns = estado.nodos ?? [], vars = estado.vars ?? [];
  const valorVar = n => {
    if (n === nombreArbol) return A === null ? null : A === '?' ? '?' : { arbol: true };
    const v = vars.find(x => x.nombre === n);
    if (!v) return undefined;
    if ('ptr' in v) return Number.isInteger(v.ptr) ? { nodo: v.ptr } : v.ptr;
    if ('par' in v) return v.par === null ? null : v.par === '?' ? '?' : { par: true };
    return undefined;
  };
  const sinTextos = linea.replace(/"(?:\\.|[^"\\])*"/g, '""').replace(/\/\/.*$/, '');
  for (const m of sinTextos.matchAll(/\b([A-Za-z_]\w*)((?:\s*->\s*[A-Za-z_]\w*)+)/g)) {
    let val = valorVar(m[1]), texto = m[1];
    if (val === undefined) continue;
    for (const campo of m[2].split('->').map(x => x.trim()).filter(Boolean)) {
      if (val === null) return `<code>${esc(texto)}</code> es NULL, y la línea hace <code>${esc(texto)}->${esc(campo)}</code> (no se puede seguir un puntero NULL).`;
      if (val === '?') return `<code>${esc(texto)}</code> tiene basura (no se inicializó o apunta a memoria inválida), y la línea hace <code>${esc(texto)}->${esc(campo)}</code>.`;
      if (val.arbol) { const i = A[campo]; val = campo === 'root' || campo === 'current' ? (Number.isInteger(i) ? { nodo: i } : i) : undefined; }
      else if (val.nodo != null) {
        const n = ns[val.nodo];
        if (campo === 'pair') val = n?.par === null ? null : n?.par === '?' ? '?' : { par: true };
        else { const i = n?.[campo]; val = ['left', 'right', 'parent'].includes(campo) ? (Number.isInteger(i) ? { nodo: i } : i) : undefined; }
      } else val = undefined;   // campos de un par (key, value): no se siguen
      texto += '->' + campo;
      if (val === undefined) break;
    }
  }
  return null;
}

// Variables que no son punteros a nodos (enteros, claves, textos) y lo que retorna la función.
export function htmlVariablesArbol(estado) {
  const vars = estado?.vars ?? [], ns = estado?.nodos ?? [];
  const valor = v => 'valor' in v ? String(v.valor)
    : 'texto' in v ? (v.texto === null ? 'NULL' : v.texto === '?' ? '? (basura)' : `"${v.texto.t}"`)
    : 'dato' in v ? (v.dato === null ? 'NULL' : v.dato === '?' ? '? (basura)' : `→ ${v.dato}`)
    : 'par' in v ? (v.par === null ? 'NULL' : v.par === '?' ? '? (basura)' : `→ par ${v.clave ?? ''}`)
    : v.ptr === null ? 'NULL' : v.ptr === '?' ? '? (basura)' : `→ nodo ${ns[v.ptr]?.clave ?? ''}`;
  const ret = vars.find(v => v.nombre === 'return');
  const otras = vars.filter(v => v.nombre !== 'return' && !('ptr' in v) && !('par' in v));
  let h = '';
  if (ret) {
    const que = 'ptr' in ret && Number.isInteger(ret.ptr) ? `el nodo <b>${esc(ns[ret.ptr]?.clave ?? '')}</b>`
      : 'par' in ret && Number.isInteger(ret.par) ? `el par <b>${esc(ret.clave ?? '')}</b>` : `<b>${esc(valor(ret))}</b>`;
    h += `<p class="retorno">↩ retorna ${que}</p>`;
  }
  if (otras.length) h += `<table class="tabla-vars"><tr><th>variable</th><th>valor</th></tr>${otras.map(v =>
    `<tr><td><code>${esc(v.nombre)}</code></td><td><code>${esc(valor(v))}</code></td></tr>`).join('')}</table>`;
  return h;
}
