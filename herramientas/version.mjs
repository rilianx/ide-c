// Pone un número de versión (?v=...) en las URLs de los JS y el CSS propios, para que
// el navegador no mezcle archivos viejos (en caché) con nuevos después de publicar.
// Uso, antes de cada commit que se publica: node herramientas/version.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const raiz = new URL('../', import.meta.url);
const v = process.argv[2] ?? new Date().toISOString().replace(/\D/g, '').slice(0, 12);
const poner = (ruta, re) => {
  const url = new URL(ruta, raiz), antes = readFileSync(url, 'utf8');
  const despues = antes.replace(re, (m, a, b) => `${a}?v=${v}${b}`);
  if (despues !== antes) writeFileSync(url, despues);
};
poner('index.html', /((?:src|href)="(?:js|css)\/[\w.-]+\.(?:js|css))(?:\?v=\w+)?(")/g);
for (const f of readdirSync(new URL('js/', raiz))) if (f.endsWith('.js'))
  poner('js/' + f, /((?:from |new URL\()'\.\/[\w.-]+\.js)(?:\?v=\w+)?(')/g);
writeFileSync(new URL('version.txt', raiz), v + '\n');   // la app lo revisa para recargarse si quedó vieja en caché
console.log('versión', v);
