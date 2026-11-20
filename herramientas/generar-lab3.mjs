// Genera ejercicios/lab3-hash/ejercicio.json: los pasos y los tests (la salida esperada se calcula
// simulando la referencia; después se valida con: node herramientas/probar-nativo.mjs ejercicios/lab3-hash).
// Uso: node herramientas/generar-lab3.mjs
import { writeFileSync } from 'node:fs';
import { describir } from './describir.mjs';
const h = (k, c) => { let x = 0n; for (const ch of k) x = (x * 33n + BigInt(ch.toLowerCase().charCodeAt(0))) & ((1n << 64n) - 1n); return Number(x % BigInt(c)); };
// simulación de la referencia sobre {t: claves ('~' inválido, null), size, current}
const valido = k => k != null && k !== '~' && !k.startsWith('~');
function insert(m, k) {
  let p = h(k, m.t.length);
  while (valido(m.t[p])) { if (m.t[p] === k) return; p = (p + 1) % m.t.length; }
  m.t[p] = k; m.size++; m.current = p;
  if (m.size > 0.7 * m.t.length) enlarge(m);
}
function enlarge(m) { const old = m.t; m.t = Array(old.length * 2).fill(null); m.size = 0; for (const k of old) if (valido(k)) insert(m, k); }
function search(m, k) { let p = h(k, m.t.length), n = 0; while (m.t[p] != null && n < m.t.length) { if (m.t[p] === k) { m.current = p; return k; } p = (p + 1) % m.t.length; n++; } return null; }
function erase(m, k) { if (search(m, k) == null) return; const p = m.current; m.t[p] = '~' + k; m.size--; }
function first(m) { for (let i = 0; i < m.t.length; i++) if (valido(m.t[i])) { m.current = i; return m.t[i]; } return null; }
function next(m) { for (let i = m.current + 1; i < m.t.length; i++) if (valido(m.t[i])) { m.current = i; return m.t[i]; } return null; }
const F = { insertMap: insert, searchMap: search, eraseMap: erase, firstMap: first, nextMap: next, enlarge };

const B = () => ['olla', null, 'case', null, 'cesa', null, 'saco', 'carro', 'casa', null];
const con = (cambios) => { const t = B(); for (const [i, k] of Object.entries(cambios)) t[i] = k; return t; };
// test(nombre, entrada {tabla, current}, llamada [f, ...args], opciones {current: revisar current})
function T(nombre, tabla, llamada, { current, revisarCurrent = true } = {}) {
  const entrada = { tabla };
  if (current != null) entrada.current = current;
  const m = { t: [...tabla], size: tabla.filter(valido).length, current: current ?? -1 };
  const r = F[llamada[0]](m, llamada[1]);
  const salida = {};
  if (['searchMap', 'firstMap', 'nextMap'].includes(llamada[0])) salida.retornos = [r];
  salida.tabla = m.t.map(k => k && k.startsWith('~') ? '~' : k);
  salida.size = m.size;
  if (revisarCurrent) salida.current = m.current;
  return { nombre, entrada, llamadas: [llamada], salida };
}
// cada par con su hash, para los enunciados
const pasos = [
  { titulo: '1. createMap', funciones: ['createMap'],
    enunciado: 'Implementa `HashMap * createMap(long capacity)`: reserva memoria para un `HashMap`, crea el arreglo `buckets` con `capacity` casillas nulas (con `calloc`), deja `size` en 0, `capacity` en la capacidad dada y `current` en -1, y retorna el mapa.',
    tests: [
      { nombre: 'crea una tabla vacía de 10 casillas', entrada: { tabla: null }, llamadas: [['createMap', 10]], salida: { tabla: Array(10).fill(null), size: 0, current: -1 } },
      { nombre: 'con otra capacidad (5)', entrada: { tabla: null }, llamadas: [['createMap', 5]], salida: { tabla: Array(5).fill(null), size: 0, current: -1 } },
    ],
    plantillas: { createMap: 'HashMap * createMap(long capacity) {\n\n}\n' } },
  { titulo: '2. insertMap', funciones: ['insertMap'],
    enunciado: 'Implementa `void insertMap(HashMap * map, char * key, void * value)`: inserta el par (key, value) y deja `current` en su posición.\n\n1. Calcula la posición con `hash(key, map->capacity)`.\n2. Si la casilla está ocupada por un par válido, avanza a la siguiente (el arreglo es **circular**: después de la última viene la 0). Una casilla está disponible si es `NULL` o si tiene un par inválido (`key == NULL`).\n3. Pon ahí el par nuevo (`createPair`) y aumenta `size`.\n\nNo insertes claves repetidas (usa `is_equal`). Si después de insertar `size > 0.7 * capacity`, llama a `enlarge(map)`.',
    tests: [
      T('sin colisión: «gato» (hash 3) va a la casilla 3', B(), ['insertMap', 'gato', 7]),
      T('colisión: «mano» (hash 7) avanza hasta la 9', B(), ['insertMap', 'mano', 7]),
      T('clave repetida: «case» no se inserta', B(), ['insertMap', 'case', 9], { revisarCurrent: false }),
      T('usa la casilla de un par inválido: «uva» (hash 4)', con({ 4: '~cesa' }), ['insertMap', 'uva', 7]),
      T('circular: «sol» (hash 6) pasa por la 9 y sigue en la 0', ['olla', null, null, null, null, null, 'saco', 'carro', 'casa', 'lago'], ['insertMap', 'sol', 7]),
      T('con más de 0.7 de carga llama a enlarge', con({ 3: 'gato' }), ['insertMap', 'mano', 8], { revisarCurrent: false }),
    ],
    plantillas: { insertMap: 'void insertMap(HashMap * map, char * key, void * value) {\n\n}\n' } },
  { titulo: '3. searchMap', funciones: ['searchMap'],
    enunciado: 'Implementa `Pair * searchMap(HashMap * map, char * key)`: retorna el par con esa clave y deja `current` en su posición.\n\n1. Calcula la posición con `hash(key, map->capacity)`.\n2. Si ahí no está la clave, avanza a la siguiente casilla (circular).\n3. Si llegas a una casilla `NULL`, la clave no está: retorna `NULL` sin seguir avanzando.\n\nUn par inválido (`key == NULL`) no detiene la búsqueda: hay que pasarlo.',
    tests: [
      T('encuentra «carro» en su casilla (7)', B(), ['searchMap', 'carro']),
      T('encuentra «mano» después de una colisión (casilla 9)', con({ 9: 'mano' }), ['searchMap', 'mano']),
      T('«holo» (hash 2) no está: retorna NULL', B(), ['searchMap', 'holo'], { revisarCurrent: false }),
      T('pasa sobre un par inválido y encuentra «mano»', con({ 8: '~casa', 9: 'mano' }), ['searchMap', 'mano']),
      T('circular: «sol» (hash 6) está en la casilla 1', ['olla', 'sol', null, null, null, null, 'saco', 'carro', 'casa', 'lago'], ['searchMap', 'sol']),
    ],
    plantillas: { searchMap: 'Pair * searchMap(HashMap * map, char * key) {\n\n}\n' } },
  { titulo: '4. eraseMap', funciones: ['eraseMap'],
    enunciado: 'Implementa `void eraseMap(HashMap * map, char * key)`: busca el par con esa clave y lo invalida, poniendo su clave en `NULL` (`par->key = NULL`). **No elimines el par**. Disminuye `size`. Si la clave no está, no hace nada.',
    tests: [
      T('invalida «olla» (casilla 0)', B(), ['eraseMap', 'olla'], { revisarCurrent: false }),
      T('invalida «mano», que está después de una colisión', con({ 9: 'mano' }), ['eraseMap', 'mano'], { revisarCurrent: false }),
      T('«holo» no está: la tabla no cambia', B(), ['eraseMap', 'holo'], { revisarCurrent: false }),
    ],
    plantillas: { eraseMap: 'void eraseMap(HashMap * map, char * key) {\n\n}\n' } },
  { titulo: '5. firstMap', funciones: ['firstMap'],
    enunciado: 'Implementa `Pair * firstMap(HashMap * map)`: retorna el primer par **válido** del arreglo (de la casilla 0 en adelante) y deja `current` en su posición. Si no hay ninguno, retorna `NULL`.',
    tests: [
      T('retorna «olla» (casilla 0)', B(), ['firstMap']),
      T('salta un par inválido: retorna «case» (casilla 2)', con({ 0: '~olla' }), ['firstMap']),
      T('en una tabla vacía retorna NULL', Array(10).fill(null), ['firstMap']),
    ],
    plantillas: { firstMap: 'Pair * firstMap(HashMap * map) {\n\n}\n' } },
  { titulo: '6. nextMap', funciones: ['nextMap'],
    enunciado: 'Implementa `Pair * nextMap(HashMap * map)`: retorna el siguiente par **válido** después de la casilla `current` y actualiza `current`. Si no hay más, retorna `NULL`.',
    tests: [
      T('desde la casilla 0 retorna «case» (casilla 2)', B(), ['nextMap'], { current: 0 }),
      T('desde la casilla 7 retorna «casa» (casilla 8)', B(), ['nextMap'], { current: 7 }),
      T('salta un par inválido: desde la 2 retorna «saco» (casilla 6)', con({ 4: '~cesa' }), ['nextMap'], { current: 2 }),
      T('desde la última ocupada (8) retorna NULL', B(), ['nextMap'], { current: 8 }),
    ],
    plantillas: { nextMap: 'Pair * nextMap(HashMap * map) {\n\n}\n' } },
  { titulo: '7. enlarge', funciones: ['enlarge'],
    enunciado: 'Implementa `void enlarge(HashMap * map)`: duplica la capacidad y reubica los pares.\n\n1. Guarda el arreglo actual en una variable auxiliar (`Pair ** old_buckets = map->buckets;`).\n2. Duplica `capacity`.\n3. Asigna a `map->buckets` un arreglo nuevo con la nueva capacidad (casillas nulas).\n4. Deja `size` en 0.\n5. Inserta en el mapa los pares **válidos** del arreglo antiguo (usa `insertMap`).',
    tests: [
      T('duplica la capacidad y reubica los 6 pares', B(), ['enlarge'], { revisarCurrent: false }),
      T('los pares inválidos no se reinsertan', con({ 4: '~cesa' }), ['enlarge'], { revisarCurrent: false }),
    ],
    plantillas: { enlarge: 'void enlarge(HashMap * map) {\n\n}\n' } },
];
const ej = {
  id: 'lab3-hash',
  titulo: 'Lab 3. Tabla hash (mapa)',
  descripcion: 'Implementa un mapa con una tabla hash (direccionamiento abierto con sondeo lineal), una función a la vez en hashmap.c. Las funciones que no escribas usan la implementación del curso, así puedes probar cada una por separado. createPair, hash e is_equal están en hashmap.h. En los dibujos, ~ es un par inválido (key NULL).',
  archivos: [{ nombre: 'hashmap.c', editable: true }, { nombre: 'hashmap.h', editable: false }, { nombre: 'ayudas.c', editable: false }],
  ocultos: ['oculto/hashmap_ref.c.enc', 'oculto/vis.c'],
  alumno: 'hashmap.c',
  referencia: 'oculto/hashmap_ref.c.enc',
  ayudas: 'ayudas.c',
  modelo: 'tabla',
  estructuras: { HashMap: { buckets: 'Pair **', size: 'long', capacity: 'long', current: 'long' }, Pair: { key: 'char *', value: 'void *' } },
  constructores: [{ nombre: 'createPair', tipo: 'Pair', params: ['char *', 'void *'] }],
  llamadas: [{ nombre: 'insertMap', params: ['HashMap *', 'char *', 'void *'] }, { nombre: 'enlarge', params: ['HashMap *'] }, { nombre: 'searchMap', params: ['HashMap *', 'char *'], retorno: 'Pair *' }],
  funciones: ['createMap', 'insertMap', 'searchMap', 'eraseMap', 'firstMap', 'nextMap', 'enlarge'],
  visual: { archivo: 'oculto/vis.c', variable: 'map', tipo: 'HashMap', textos: true },
  solucion: 'oculto/solucion.enc',
  pasos,
};
writeFileSync(process.argv[2] ?? new URL('../ejercicios/lab3-hash/ejercicio.json', import.meta.url), JSON.stringify(describir(ej, 'lab3-hash'), null, 2) + '\n');
for (const p of pasos) for (const t of p.tests) console.log(p.titulo, '|', t.nombre, '|', JSON.stringify(t.salida));
