// Cifrado de archivos ocultos (AES-GCM; la clave se deriva de una contraseña con PBKDF2).
// Formato: base64 de [sal (16 bytes) | iv (12 bytes) | texto cifrado].
// Funciona en el navegador y en node (los dos tienen crypto.subtle).
//
// - La referencia que usa el modo estudiante se cifra con CLAVE_INTERNA, que va en la página:
//   solo evita que se lea abriendo el archivo; quien sepa usar el navegador la puede sacar.
// - La solución del modo profesor se cifra con la contraseña del profesor (no está en ninguna parte).

export const CLAVE_INTERNA = 'ide-c:referencia-interna';
const ITERACIONES = 150000;

const b64 = {
  de: s => Uint8Array.from(atob(s.replace(/\s+/g, '')), c => c.charCodeAt(0)),
  a: bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); },
};

async function claveDe(contrasena, sal) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(contrasena), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: sal, iterations: ITERACIONES, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function cifrar(texto, contrasena) {
  const sal = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const c = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await claveDe(contrasena, sal), new TextEncoder().encode(texto)));
  const todo = new Uint8Array(28 + c.length);
  todo.set(sal, 0); todo.set(iv, 16); todo.set(c, 28);
  return b64.a(todo).replace(/(.{76})/g, '$1\n') + '\n';
}

// Lanza un error si la contraseña no es la correcta.
export async function descifrar(cifrado, contrasena) {
  const todo = b64.de(cifrado);
  const sal = todo.subarray(0, 16), iv = todo.subarray(16, 28), c = todo.subarray(28);
  try {
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await claveDe(contrasena, sal), c));
  } catch {
    throw new Error('contraseña incorrecta');
  }
}

// Versión compacta de un archivo C (sin comentarios ni sangrías; cada bloque entre directivas
// del preprocesador en una línea). Es la que se cifra para el modo estudiante.
export function compactar(c) {
  const sin = c.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const out = [];
  let acum = [];
  for (const l of sin.split('\n')) {
    const t = l.trim();
    if (!t) continue;
    if (t.startsWith('#')) { if (acum.length) out.push(acum.join(' ')); acum = []; out.push(t); }
    else acum.push(t.replace(/\s+/g, ' '));
  }
  if (acum.length) out.push(acum.join(' '));
  return out.join('\n') + '\n';
}
