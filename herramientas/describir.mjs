// Agrega a cada test su descripción escrita a mano (qué entra y qué se espera), desde
// herramientas/descripciones/<lab>.json. La clave es el nombre del test o, si se repite entre
// funciones, «función|nombre». Falla si a algún test le falta su descripción.
// Uso: node herramientas/describir.mjs lab2-lista   (los generadores de Lab 3 y 4 ya la usan)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const aqui = fileURLToPath(new URL('.', import.meta.url));

export function describir(ej, lab) {
  const d = JSON.parse(readFileSync(`${aqui}descripciones/${lab}.json`, 'utf8'));
  const faltan = [];
  for (const p of ej.pasos) for (const t of p.tests) {
    const texto = d[`${p.funciones[0]}|${t.nombre}`] ?? d[t.nombre];
    if (!texto) faltan.push(`${p.titulo}: ${t.nombre}`);
    else t.descripcion = texto;
  }
  if (faltan.length) throw new Error('Tests sin descripción:\n' + faltan.join('\n'));
  return ej;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const lab = process.argv[2], ruta = `${aqui}../ejercicios/${lab}/ejercicio.json`;
  const ej = describir(JSON.parse(readFileSync(ruta, 'utf8')), lab);
  writeFileSync(ruta, JSON.stringify(ej, null, 2) + '\n');
  console.log(`${lab}: descripciones agregadas`);
}
