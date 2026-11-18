// @basthon/xcc-wasm: a persistent C REPL in WebAssembly, for Basthon.

/** URL of the compiler (xcc compiled to WebAssembly). */
export const ccWasmURL: URL;
/** URL of the runtime (libc and REPL support). */
export const runtimeWasmURL: URL;
/** Symbol map of the runtime (data symbol addresses). */
export const runtimeMap: string;
/** C headers: {relative path: content}, installed in /usr/include. */
export const headers: { [path: string]: string };

/** Flat in-memory file system. */
export class MemFS {
  constructor();
  writeFile(path: string, data: Uint8Array | string): void;
  readFile(path: string): Uint8Array | undefined;
  readText(path: string): string | undefined;
  unlink(path: string): boolean;
  isDir(path: string): boolean;
}

/** Thrown by proc_exit (exit() in C). */
export class WASIExit extends Error {
  code: number;
}

/** Minimal WASI (preview1) with an in-memory file system. */
export class WASI {
  constructor(options?: {
    args?: string[];
    env?: { [name: string]: string };
    fs?: MemFS;
    stdin?: () => Uint8Array | string | null;
    stdout?: (bytes: Uint8Array) => void;
    stderr?: (bytes: Uint8Array) => void;
  });
  readonly fs: MemFS;
  readonly imports: WebAssembly.ModuleImports;
  setMemory(memory: WebAssembly.Memory): void;
}

/** The compiler, running on a file system where headers are in /usr/include. */
export class WasmCompiler {
  constructor(ccModule: WebAssembly.Module, fs: MemFS);
  compile(args: string[]): Promise<{ status: number; messages: string }>;
}

export interface CReplOptions {
  ccModule: WebAssembly.Module;
  runtimeModule: WebAssembly.Module;
  runtimeMap: string;
  headers: { [path: string]: string };
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  /** Synchronous: returns a line, or null for the end of file. */
  stdin: () => string | null;
  /** File system shared by the compiler and the C program. */
  fs?: MemFS;
  /**
   * JavaScript functions callable from C once declared (e.g. in a header):
   * arguments and result are numbers (pointers are addresses in `memory`),
   * an exception is a runtime error.
   */
  functions?: { [name: string]: (...args: number[]) => number | void };
}

export interface CReplResult {
  /** "error": compile or link error, "exception": runtime error. */
  status: "ok" | "error" | "exception";
  /** Display of the last expression of the cell (without `;'), if any. */
  result?: string;
}

/** Persistent C REPL: each cell is compiled and linked to the previous ones. */
export class CRepl {
  static create(options: CReplOptions): Promise<CRepl>;
  readonly fs: MemFS;
  /** Memory of the C program. */
  readonly memory: WebAssembly.Memory;
  /** The C string (UTF-8, null-terminated) at an address. */
  readString(ptr: number): string;
  run(code: string): Promise<CReplResult>;
}
