// Valida un ejercicio con gcc: arma los tests igual que la app y los corre en nativo.
// Uso: node herramientas/probar-nativo.mjs ejercicios/lab2-lista [list.c del estudiante] [carpeta temporal]
// Sin archivo de estudiante, todo usa la referencia y deberían pasar todos los tests.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
const [,, EJ, ALUMNO, OUT = tmpdir() + '/ide-c-nativo'] = process.argv;
const P = await import(new URL('../js/proyecto.js', import.meta.url));
const ej = JSON.parse(readFileSync(EJ + '/ejercicio.json', 'utf8'));
const archivos = {}; for (const a of ej.archivos) archivos[a.nombre] = readFileSync(EJ + '/' + a.nombre, 'utf8');
if (ALUMNO) archivos[ej.alumno] = readFileSync(ALUMNO, 'utf8');
const { descifrar, CLAVE_INTERNA } = await import(new URL('../js/cifrado.js', import.meta.url));
const ocultos = {}; for (const o of ej.ocultos ?? []) { const t = readFileSync(EJ + '/' + o, 'utf8'); ocultos[o] = o.endsWith('.enc') ? await descifrar(t, CLAVE_INTERNA) : t; }
const tests = ej.pasos.flatMap((p, k) => p.tests.map(t => ({ ...t, paso: k + 1 })));
const prog = P.armarTests(ej, archivos, ocultos, tests);
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
for (const [n, c] of Object.entries(prog.files)) writeFileSync(OUT + '/' + n, c);
writeFileSync(OUT + '/nativo.c', `#include "__programa.c"\n#include <string.h>\nint main(int c, char **v) {\n  switch (atoi(v[1])) {\n${tests.map((t, i) => `  case ${i}: __test_${i}(); break;`).join('\n')}\n  }\n  return 0;\n}\n`);
const cc = spawnSync('gcc', ['-g', '-Wall', '-o', OUT + '/nativo', OUT + '/nativo.c'], { encoding: 'utf8' });
if (cc.status) { console.log('NO COMPILA:\n' + cc.stderr); process.exit(1); }
if (cc.stderr) console.log('avisos gcc:\n' + cc.stderr);
console.log('propias del estudiante:', prog.propias.join(', ') || '(ninguna)');
let ok = 0;
tests.forEach((t, i) => {
  const r = spawnSync(OUT + '/nativo', [String(i)], { encoding: 'utf8', timeout: 3000 });
  const bien = r.status === 0 && P.mismaSalida(t.esperado, r.stdout);
  if (bien) ok++;
  else console.log(`✗ paso ${t.paso} · ${t.nombre}\n   esperado: ${JSON.stringify(t.esperado)}\n   obtenido: ${JSON.stringify(r.stdout)} ${r.signal || (r.status ? 'status ' + r.status : '')}`);
});
console.log(`${ok}/${tests.length} tests pasan`);
