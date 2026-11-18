// Genera js/mensajes-xcc.js: todos los mensajes del compilador (xcc) y de su librería, en castellano.
// Las traducciones (herramientas/mensajes-xcc.jsonl) se hicieron con un modelo (Claude Haiku) a partir
// de los textos que trae vendor/xcc-wasm/build/*.wasm, y se revisaron; aquí solo se convierten en
// expresiones regulares: cada %s, %.*s, %d… del original pasa a ser un grupo de captura, y en la
// traducción se reemplaza, en el mismo orden, por lo capturado.
//
// Uso: node herramientas/generar-mensajes.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const raiz = new URL('../', import.meta.url);
const lineas = readFileSync(new URL('herramientas/mensajes-xcc.jsonl', raiz), 'utf8').split('\n').filter(l => l.trim());
const PH = /%(?:\.\*s|[-0-9]*l{0,2}[sdcuxzi]|zd|zu|zx|%)/g;   // marcadores de printf
const grupo = p => p === '%%' ? '%' : p === '%c' ? '(.)' : /[sS]$/.test(p) ? '(.+?)' : /x$/.test(p) ? '([0-9a-fA-F]+)' : '(-?\\d+)';
const escapar = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const salida = [], vistos = new Set();
let saltados = 0;
for (const l of lineas) {
  let e;
  try { e = JSON.parse(l); } catch { saltados++; continue; }
  const o = (e.original ?? '').trim(), es = (e.es ?? '').trim();
  if (!o || !es || vistos.has(o)) continue;
  const po = o.match(PH) ?? [], pe = es.match(PH) ?? [];
  if (po.filter(p => p !== '%%').length !== pe.filter(p => p !== '%%').length) { saltados++; continue; }   // la traducción perdió o agregó un marcador
  if (o.replace(PH, '').replace(/[^A-Za-z]/g, '').length < 4) continue;   // casi solo marcadores: no sirve para reconocer
  vistos.add(o);
  // la expresión: el original con sus marcadores como grupos (las comillas `x' pueden venir como `x`)
  const re = o.split(PH).map(escapar).reduce((acc, parte, i) => acc + (i ? grupo(po[i - 1]) : '') + parte, '').replace(/'/g, "['`]");
  salida.push([re, es, (e.pista ?? '').trim()]);
}
salida.sort((a, b) => b[0].length - a[0].length);   // primero los más largos (más específicos)
writeFileSync(new URL('js/mensajes-xcc.js', raiz),
  '// Generado por herramientas/generar-mensajes.mjs (no editar a mano).\n' +
  '// [expresión regular sobre el mensaje en inglés, traducción con %s… en el orden del original, pista]\n' +
  'export default ' + JSON.stringify(salida, null, 0).replace(/\],\[/g, '],\n[') + ';\n');
console.log(`${salida.length} mensajes; ${saltados} saltados (marcadores que no coinciden o JSON inválido)`);
