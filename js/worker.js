// Web Worker: compila y ejecuta C con xcc-wasm (xcc compilado a WebAssembly).
// Corre aparte de la página para que un bucle infinito se pueda detener (terminate).
//
// Mensaje recibido (un trabajo):
//   { files: {nombre: texto}, prelude: '#include "..."', calls: [{id, code, stdin}] }
// Mensajes enviados:
//   { tipo: 'listo' }                                     el compilador ya está cargado
//   { tipo: 'compilado', ok, mensajes }                   resultado de compilar el programa
//   { tipo: 'llamada', id, ok, stdout, stderr, error }    resultado de cada llamada
//   { tipo: 'fin' }
import { ccWasmURL, runtimeWasmURL, runtimeMap, headers, CRepl } from '../vendor/xcc-wasm/js/index.mjs';

async function modulo(url) {
  const r = await fetch(url);
  try { return await WebAssembly.compileStreaming(r.clone()); }
  catch { return await WebAssembly.compile(await r.arrayBuffer()); }   // servidor sin tipo application/wasm
}
const modulos = Promise.all([modulo(ccWasmURL), modulo(runtimeWasmURL)]);
modulos.then(() => postMessage({ tipo: 'listo' }), e => postMessage({ tipo: 'fallo', mensaje: String(e?.message ?? e) }));

onmessage = async ({ data: trabajo }) => {
  const [ccModule, runtimeModule] = await modulos;
  let out = '', err = '', entrada = [];
  const repl = await CRepl.create({
    ccModule, runtimeModule, runtimeMap, headers,
    stdout: t => { out += t; },
    stderr: t => { err += t; },
    stdin: () => entrada.length ? entrada.shift() : null,
  });
  for (const [nombre, texto] of Object.entries(trabajo.files)) repl.fs.writeFile('/' + nombre, texto);

  const c = await repl.run(trabajo.prelude);
  postMessage({ tipo: 'compilado', ok: c.status === 'ok', mensajes: err });
  if (c.status !== 'ok') { postMessage({ tipo: 'fin' }); return; }

  for (const llamada of trabajo.calls) {
    out = ''; err = '';
    const texto = llamada.stdin ?? '';
    entrada = texto ? (texto.endsWith('\n') ? texto : texto + '\n').split(/(?<=\n)/) : [];
    const r = await repl.run(llamada.code);
    // «Runtime error: ...» del intérprete (NULL, índice fuera de rango, división por cero...)
    const error = r.status === 'exception' ? (err.match(/Runtime error:[^\n]*/)?.[0] ?? 'Error de ejecución') : null;
    postMessage({ tipo: 'llamada', id: llamada.id, ok: r.status === 'ok', stdout: out, stderr: err, error });
  }
  postMessage({ tipo: 'fin' });
};
