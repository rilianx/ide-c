// Carga de ejercicios: ejercicios/index.json lista las carpetas; cada una tiene
// ejercicio.json, sus archivos visibles y los ocultos (referencia y ayudas).
// Lo que escribe el estudiante se guarda en el navegador (localStorage), por ejercicio.

import { descifrar, CLAVE_INTERNA } from './cifrado.js?v=202611181610';

const BASE = new URL('../ejercicios/', import.meta.url);

async function texto(url) {
  const r = await fetch(url, { cache: 'no-cache' });   // siempre la versión publicada (revalida con el servidor)
  if (!r.ok) throw new Error(`No se pudo cargar ${url} (${r.status})`);
  return r.text();
}

export async function listaEjercicios() {
  return JSON.parse(await texto(new URL('index.json', BASE)));
}

export async function cargarEjercicio(id) {
  const dir = new URL(id + '/', BASE);
  const ej = JSON.parse(await texto(new URL('ejercicio.json', dir)));
  const originales = {}, ocultos = {};
  await Promise.all([
    ...ej.archivos.map(async a => { originales[a.nombre] = await texto(new URL(a.nombre, dir)); }),
    ...ej.ocultos.map(async o => {   // los .enc vienen cifrados con la clave interna
      const t = await texto(new URL(o, dir));
      ocultos[o] = o.endsWith('.enc') ? await descifrar(t, CLAVE_INTERNA) : t;
    }),
  ]);
  return { ej, originales, ocultos };
}

// Modo profesor (?profesor en la URL): list.c parte con todas las funciones hechas (las del curso),
// y se guarda aparte, sin tocar lo del modo normal.
export const MODO_PROFESOR = new URLSearchParams(location.search).has('profesor');
// La solución legible (modo profesor), cifrada con la contraseña del profesor.
// Lanza «contraseña incorrecta» si no corresponde.
export async function cargarSolucion(ej, contrasena) {
  if (!ej.solucion) throw new Error('este ejercicio no tiene solución cifrada');
  return descifrar(await texto(new URL(ej.solucion, new URL(ej.id + '/', BASE))), contrasena);
}

const clave = id => `ide-c:${id}` + (MODO_PROFESOR ? ':profesor' : '');

// Archivos editables guardados; si no hay, los originales.
export function archivosGuardados(ej, originales) {
  let guardados = {};
  try { guardados = JSON.parse(localStorage.getItem(clave(ej.id)) || '{}'); } catch { /* sin almacenamiento */ }
  const archivos = {};
  for (const a of ej.archivos) archivos[a.nombre] = a.editable && typeof guardados[a.nombre] === 'string' ? guardados[a.nombre] : originales[a.nombre];
  // cambios del ejercicio que afectan lo guardado (por ejemplo, un .h que se renombró)
  for (const a of ej.archivos) if (a.editable) for (const [antes, despues] of ej.migrar ?? []) archivos[a.nombre] = archivos[a.nombre].split(antes).join(despues);
  return archivos;
}

export function guardar(ej, archivos) {
  const editables = {};
  for (const a of ej.archivos) if (a.editable) editables[a.nombre] = archivos[a.nombre];
  try { localStorage.setItem(clave(ej.id), JSON.stringify(editables)); } catch { /* sin almacenamiento */ }
}

export function borrarGuardado(ej) {
  try { localStorage.removeItem(clave(ej.id)); } catch { /* sin almacenamiento */ }
}
