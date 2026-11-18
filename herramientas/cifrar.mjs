// Cifra (o descifra para editar) la solución de un ejercicio.
//
//   node herramientas/cifrar.mjs cifrar ejercicios/lab2-lista CONTRASEÑA
//     lee  <ej>/fuente/list_ref.c   (en claro; la carpeta fuente/ no se sube a git)
//     crea <ej>/oculto/list_ref.c.enc  (compacta, con la clave interna: la usa el modo estudiante)
//          <ej>/oculto/solucion.enc    (completa y legible, con la contraseña: modo profesor)
//
//   node herramientas/cifrar.mjs descifrar ejercicios/lab2-lista CONTRASEÑA
//     recupera <ej>/fuente/list_ref.c desde oculto/solucion.enc, para editarla
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { cifrar, descifrar, compactar, CLAVE_INTERNA } from '../js/cifrado.js';

const [,, accion, EJ, clave] = process.argv;
if (!['cifrar', 'descifrar'].includes(accion) || !EJ || !clave) {
  console.log('Uso: node herramientas/cifrar.mjs cifrar|descifrar <carpeta del ejercicio> <contraseña>');
  process.exit(1);
}
const ej = JSON.parse(readFileSync(`${EJ}/ejercicio.json`, 'utf8'));
const fuente = `${EJ}/fuente/${ej.referencia.split('/').pop().replace(/\.enc$/, '')}`;
if (accion === 'cifrar') {
  const texto = readFileSync(fuente, 'utf8');
  writeFileSync(`${EJ}/${ej.referencia}`, await cifrar(compactar(texto), CLAVE_INTERNA));
  writeFileSync(`${EJ}/${ej.solucion}`, await cifrar(texto, clave));
  console.log(`Listo: ${ej.referencia} y ${ej.solucion}`);
} else {
  const texto = await descifrar(readFileSync(`${EJ}/${ej.solucion}`, 'utf8'), clave);
  mkdirSync(`${EJ}/fuente`, { recursive: true });
  writeFileSync(fuente, texto);
  console.log(`Listo: ${fuente} (no se sube a git; después de editarla, vuelve a cifrar)`);
}
