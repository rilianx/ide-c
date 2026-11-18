// @basthon/xcc-wasm: a persistent C REPL in WebAssembly, for Basthon.
export const ccWasmURL = new URL("../build/cc.wasm", import.meta.url);
export const runtimeWasmURL = new URL("../build/runtime.wasm", import.meta.url);
export { default as runtimeMap } from "../build/runtime-map.mjs";
export { default as headers } from "../build/headers.mjs";
export { CRepl, WasmCompiler } from "./repl.mjs";
export { MemFS, WASI, WASIExit } from "./wasi.mjs";
