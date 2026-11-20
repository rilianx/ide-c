// Genera ejercicios/lab4-arbol/ejercicio.json: los pasos y los tests (la salida esperada se calcula
// simulando la referencia; después se valida con: node herramientas/probar-nativo.mjs ejercicios/lab4-arbol).
// Uso: node herramientas/generar-lab4.mjs
import { writeFileSync } from 'node:fs';
import { describir } from './describir.mjs';

// árbol con padres, desde las claves en preorden
function construir(claves) {
  const t = { root: null, current: null };
  for (const k of claves) insertar(t, k, false);
  t.current = null;
  return t;
}
const nodo = (t, k) => { let x = t.root; while (x && x.k !== k) x = k < x.k ? x.l : x.r; return x; };
function insertar(t, k, actualizar = true) {
  let p = null, x = t.root;
  while (x) { if (x.k === k) return; p = x; x = k < x.k ? x.l : x.r; }
  const n = { k, l: null, r: null, p };
  if (!p) t.root = n; else if (k < p.k) p.l = n; else p.r = n;
  if (actualizar) t.current = n;
}
const minimo = x => { if (!x) return null; while (x.l) x = x.l; return x; };
function buscar(t, k) { const x = nodo(t, k); if (x) t.current = x; return x ? x.k : null; }
function quitar(t, n) {
  if (n.l && n.r) { const m = minimo(n.r); n.k = m.k; quitar(t, m); return; }
  const h = n.l ?? n.r;
  if (h) h.p = n.p;
  if (!n.p) t.root = h; else if (n.p.l === n) n.p.l = h; else n.p.r = h;
}
function borrar(t, k) { const x = nodo(t, k); if (!x) return; t.current = x; quitar(t, x); }
function primero(t) { const m = minimo(t.root); t.current = m; return m ? m.k : null; }
function siguiente(t) {
  let x = t.current;
  if (!x) return null;
  if (x.r) x = minimo(x.r);
  else { let p = x.p; while (p && p.r === x) { x = p; p = p.p; } x = p; }
  t.current = x;
  return x ? x.k : null;
}
function cota(t, k) {
  let x = t.root, ub = null;
  while (x) { if (x.k === k) return k; if (k < x.k) { ub = x; x = x.l; } else x = x.r; }
  return ub ? ub.k : null;
}
const preorden = n => n ? [n.k, ...preorden(n.l), ...preorden(n.r)] : [];
const camino = (t, ruta) => ruta.split('->').slice(1).reduce((x, c) => x && (c === 'left' ? x.l : x.r), t.root);

const B = [5239, 1273, 8213, 6980];   // el árbol del enunciado (en preorden)
// test(nombre, árbol de entrada, llamada, {current: clave de entrada, revisarCurrent})
function T(nombre, arbol, llamada, { current, revisarCurrent = true } = {}) {
  const t = construir(arbol);
  if (current != null) t.current = nodo(t, current);
  const [f, a] = llamada;
  let r, retorna = true;
  if (f === 'searchTreeMap') r = buscar(t, a);
  else if (f === 'insertTreeMap') { insertar(t, a); retorna = false; }
  else if (f === 'eraseTreeMap') { borrar(t, a); retorna = false; }
  else if (f === 'minimum') r = minimo(camino(t, 'root' + a.replace(/^root/, '')))?.k ?? null;
  else if (f === 'firstTreeMap') r = primero(t);
  else if (f === 'nextTreeMap') r = siguiente(t);
  else if (f === 'upperBound') r = cota(t, a);
  const entrada = { arbol };
  if (current != null) entrada.current = current;
  const salida = {};
  if (retorna) salida.retornos = [r];
  salida.arbol = preorden(t.root);
  if (revisarCurrent && f !== 'minimum') salida.current = t.current ? t.current.k : null;
  return { nombre, entrada, llamadas: [llamada], salida };
}

const pasos = [
  { titulo: '1. createTreeMap', funciones: ['createTreeMap'],
    enunciado: 'Implementa `TreeMap * createTreeMap(int (*lower_than)(void * key1, void * key2))`: reserva memoria para un `TreeMap`, deja `root` y `current` en `NULL`, guarda la función de comparación (`map->lower_than = lower_than;`) y retorna el mapa.',
    tests: [{ nombre: 'crea un árbol vacío que guarda lower_than', entrada: { arbol: null }, llamadas: [['createTreeMap']], salida: { arbol: [], current: null } }],
    plantillas: { createTreeMap: 'TreeMap * createTreeMap(int (*lower_than) (void * key1, void * key2)) {\n\n}\n' } },
  { titulo: '2. searchTreeMap', funciones: ['searchTreeMap'],
    enunciado: 'Implementa `Pair * searchTreeMap(TreeMap * tree, void * key)`: busca el nodo con esa clave y retorna su `pair`, dejando `current` en ese nodo. Si no está, retorna `NULL`.\n\nDesde `root`: si la clave es igual (`is_equal(tree, key, aux->pair->key)`), la encontraste; si es menor (`tree->lower_than(key, aux->pair->key)`), sigue por `left`; si no, por `right`.',
    tests: [
      T('encuentra la clave de la raíz (5239)', B, ['searchTreeMap', 5239]),
      T('encuentra 8213 (a la derecha)', B, ['searchTreeMap', 8213]),
      T('encuentra 6980 (derecha y luego izquierda)', B, ['searchTreeMap', 6980]),
      T('7010 no está: retorna NULL', B, ['searchTreeMap', 7010], { revisarCurrent: false }),
    ],
    plantillas: { searchTreeMap: 'Pair * searchTreeMap(TreeMap * tree, void * key) {\n\n}\n' } },
  { titulo: '3. insertTreeMap', funciones: ['insertTreeMap'],
    enunciado: 'Implementa `void insertTreeMap(TreeMap * tree, void * key, void * value)`: busca dónde va la clave (como en searchTreeMap, recordando el último nodo visitado), crea el nodo (`createTreeNode`), lo enlaza con su padre (también `nuevo->parent`) y deja `current` en él. Si la clave ya existe, no hace nada. Si el árbol está vacío, el nodo nuevo es la raíz.',
    tests: [
      T('900 queda a la izquierda de 1273', B, ['insertTreeMap', 900]),
      T('7000 queda a la derecha de 6980', B, ['insertTreeMap', 7000]),
      T('la clave 5239 ya existe: no se inserta', B, ['insertTreeMap', 5239], { revisarCurrent: false }),
      T('en un árbol vacío, el nodo nuevo es la raíz', [], ['insertTreeMap', 50]),
    ],
    plantillas: { insertTreeMap: 'void insertTreeMap(TreeMap * tree, void * key, void * value) {\n\n}\n' } },
  { titulo: '4. minimum', funciones: ['minimum'],
    enunciado: 'Implementa `TreeNode * minimum(TreeNode * x)`: retorna el nodo con la menor clave del subárbol que parte en `x`, bajando por `left` hasta el final. Si `x` no tiene hijo izquierdo, retorna `x`.',
    tests: [
      T('el mínimo de todo el árbol es 1273', B, ['minimum', 'root']),
      T('el mínimo del subárbol de 8213 es 6980', B, ['minimum', 'root->right']),
      T('1273 no tiene hijo izquierdo: retorna el mismo nodo', B, ['minimum', 'root->left']),
      T('con 100 en el árbol, el mínimo es 100', [...B, 100], ['minimum', 'root']),
    ],
    plantillas: { minimum: 'TreeNode * minimum(TreeNode * x) {\n\n}\n' } },
  { titulo: '5. removeNode', funciones: ['removeNode'],
    enunciado: 'Implementa `void removeNode(TreeMap * tree, TreeNode * node)`: saca `node` del árbol (los tests usan `eraseTreeMap`, que busca el nodo y llama a tu removeNode).\n\n- **Sin hijos**: el padre deja de apuntarlo (o `root` queda en `NULL`).\n- **Un hijo**: el hijo toma su lugar (y su `parent` pasa a ser el padre de `node`; si `node` era la raíz, el hijo es la nueva `root`).\n- **Dos hijos**: busca el menor del subárbol derecho (`minimum(node->right)`), copia su clave y valor en `node` y elimina ese nodo (con removeNode).',
    tests: [
      T('nodo sin hijos (1273)', B, ['eraseTreeMap', 1273], { revisarCurrent: false }),
      T('nodo con un hijo (8213): 6980 toma su lugar', B, ['eraseTreeMap', 8213], { revisarCurrent: false }),
      T('nodo con dos hijos (5239): queda 6980 en la raíz', B, ['eraseTreeMap', 5239], { revisarCurrent: false }),
      T('la raíz con un solo hijo: el hijo es la nueva raíz', [5239, 8213, 6980], ['eraseTreeMap', 5239], { revisarCurrent: false }),
      T('el único nodo: el árbol queda vacío', [5239], ['eraseTreeMap', 5239], { revisarCurrent: false }),
    ],
    plantillas: { removeNode: 'void removeNode(TreeMap * tree, TreeNode * node) {\n\n}\n' } },
  { titulo: '6. firstTreeMap', funciones: ['firstTreeMap'],
    enunciado: 'Implementa `Pair * firstTreeMap(TreeMap * tree)`: retorna el par con la menor clave (el nodo mínimo del árbol) y deja `current` en ese nodo. Si el árbol está vacío, retorna `NULL`.',
    tests: [
      T('retorna 1273, la menor clave', B, ['firstTreeMap']),
      T('con 100 en el árbol, retorna 100', [...B, 100], ['firstTreeMap']),
      T('en un árbol vacío retorna NULL', [], ['firstTreeMap'], { revisarCurrent: false }),
    ],
    plantillas: { firstTreeMap: 'Pair * firstTreeMap(TreeMap * tree) {\n\n}\n' } },
  { titulo: '7. nextTreeMap', funciones: ['nextTreeMap'],
    enunciado: 'Implementa `Pair * nextTreeMap(TreeMap * tree)`: retorna el par siguiente (la menor clave mayor que la de `current`) y deja `current` en ese nodo.\n\n- Si `current` tiene hijo derecho: el siguiente es el mínimo de ese subárbol.\n- Si no: sube por `parent` hasta llegar a un padre desde su hijo izquierdo; ese padre es el siguiente.\n\nSi no hay siguiente, retorna `NULL`.',
    tests: [
      T('con hijo derecho: desde 1273 va a 2000', [...B, 2000], ['nextTreeMap'], { current: 1273 }),
      T('desde la raíz (5239) va a 6980', B, ['nextTreeMap'], { current: 5239 }),
      T('sin hijo derecho: desde 2000 sube a 5239', [...B, 2000], ['nextTreeMap'], { current: 2000 }),
      T('desde 8213, la mayor: retorna NULL', B, ['nextTreeMap'], { current: 8213 }),
    ],
    plantillas: { nextTreeMap: 'Pair * nextTreeMap(TreeMap * tree) {\n\n}\n' } },
  { titulo: '8. upperBound', funciones: ['upperBound'],
    enunciado: 'Implementa `Pair * upperBound(TreeMap * tree, void * key)`: retorna el par con esa clave; si no está, el de la menor clave mayor que key (o `NULL` si no hay).\n\nHaz una búsqueda normal y usa un nodo auxiliar `ub_node` que guarde el último nodo donde bajaste por la izquierda (su clave es mayor que key).',
    tests: [
      T('6980 está: retorna 6980', B, ['upperBound', 6980], { revisarCurrent: false }),
      T('6979 no está: retorna 6980', B, ['upperBound', 6979], { revisarCurrent: false }),
      T('6981 no está: retorna 8213', B, ['upperBound', 6981], { revisarCurrent: false }),
      T('1000 no está: retorna 1273', B, ['upperBound', 1000], { revisarCurrent: false }),
      T('8214 es mayor que todas: retorna NULL', B, ['upperBound', 8214], { revisarCurrent: false }),
    ],
    plantillas: { upperBound: 'Pair * upperBound(TreeMap * tree, void * key) {\n\n}\n' } },
];
const ej = {
  id: 'lab4-arbol',
  titulo: 'Lab 4. Árbol binario de búsqueda (mapa ordenado)',
  descripcion: 'Implementa un mapa ordenado con un árbol binario de búsqueda, una función a la vez en treemap.c. Las que no escribas usan la implementación del curso, así puedes probar cada una por separado. createTreeNode, is_equal y eraseTreeMap están en treemap.h. En los tests las claves son int y los valores, palabras.',
  archivos: [{ nombre: 'treemap.c', editable: true }, { nombre: 'treemap.h', editable: false }, { nombre: 'ayudas.c', editable: false }],
  ocultos: ['oculto/treemap_ref.c.enc', 'oculto/vis.c'],
  alumno: 'treemap.c',
  referencia: 'oculto/treemap_ref.c.enc',
  ayudas: 'ayudas.c',
  modelo: 'arbol',
  estructuras: { TreeMap: { root: 'TreeNode', current: 'TreeNode' }, TreeNode: { pair: 'Pair', left: 'TreeNode', right: 'TreeNode', parent: 'TreeNode' }, Pair: { key: 'void *', value: 'void *' } },
  constructores: [{ nombre: 'createTreeNode', tipo: 'TreeNode', params: ['void *', 'void *'] }],
  llamadas: [{ nombre: 'minimum', params: ['TreeNode *'], retorno: 'TreeNode *' }, { nombre: 'removeNode', params: ['TreeMap *', 'TreeNode *'] }, { nombre: 'searchTreeMap', params: ['TreeMap *', 'void *'], retorno: 'Pair *' }],
  comandos: [
    { cat: 'Control', texto: 'if (is_equal(⟨TreeMap *⟩, ⟨void *⟩, ⟨void *⟩)) {', bloque: true },
    { cat: 'Control', texto: 'if (⟨TreeMap *⟩->lower_than(⟨void *⟩, ⟨void *⟩)) {', bloque: true },
    { cat: 'Control', texto: 'while (⟨TreeNode *⟩->left != NULL) {', bloque: true },
    { cat: 'Asignar', texto: '⟨TreeMap *⟩->lower_than = lower_than;' },
  ],
  funciones: ['createTreeMap', 'searchTreeMap', 'insertTreeMap', 'minimum', 'removeNode', 'firstTreeMap', 'nextTreeMap', 'upperBound'],
  visual: { archivo: 'oculto/vis.c', variable: 'tree', tipo: 'TreeMap', textos: true, clases: { Pair: 5 } },
  solucion: 'oculto/solucion.enc',
  pasos,
};
writeFileSync(process.argv[2] ?? new URL('../ejercicios/lab4-arbol/ejercicio.json', import.meta.url), JSON.stringify(describir(ej, 'lab4-arbol'), null, 2) + '\n');
for (const p of pasos) for (const t of p.tests) console.log(p.titulo, '|', t.nombre, '|', JSON.stringify(t.salida));
