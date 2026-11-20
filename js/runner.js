// Ejecuta trabajos en el worker, con límite de tiempo: si una llamada se demora
// demasiado (¿bucle infinito?), el worker se termina y se crea otro.

const LIMITE_MS = 4000;

export class Runner {
  constructor() {
    this.worker = null;
    this.listo = null;
    this.crear();
  }

  crear() {
    this.worker?.terminate();
    this.worker = new Worker(new URL('./worker.js?v=202611201313', import.meta.url), { type: 'module' });
    this.listo = new Promise((ok, fallo) => {
      const al = ({ data }) => {
        if (data.tipo === 'listo') { this.worker.removeEventListener('message', al); ok(); }
        if (data.tipo === 'fallo') { this.worker.removeEventListener('message', al); fallo(new Error(data.mensaje)); }
      };
      this.worker.addEventListener('message', al);
      this.worker.addEventListener('error', e => fallo(new Error(e.message || 'no se encontró vendor/xcc-wasm o el navegador no admite workers de módulo')));
    });
  }

  // trabajo: {files, prelude, calls}; eventos: {compilado(msg), llamada(msg)}.
  // Devuelve {compilado, llamadas: Map(id → resultado), detenido}.
  async ejecutar(trabajo, eventos = {}) {
    await this.listo;
    const resultado = { compilado: null, llamadas: new Map(), detenido: null };
    return new Promise(fin => {
      let reloj = null;
      const pendientes = trabajo.calls.map(c => c.id);
      const vigilar = () => {
        clearTimeout(reloj);
        reloj = setTimeout(() => {   // demasiado tiempo: se detiene todo lo que faltaba
          this.worker.removeEventListener('message', al);
          resultado.detenido = 'tiempo';
          for (const id of pendientes) if (!resultado.llamadas.has(id)) {
            const r = { id, ok: false, stdout: '', stderr: '', error: `Tiempo excedido (${LIMITE_MS / 1000} s): ¿un ciclo infinito?` };
            resultado.llamadas.set(id, r); eventos.llamada?.(r);
            break;   // solo la que estaba corriendo; las demás quedan sin ejecutar
          }
          this.crear();
          fin(resultado);
        }, LIMITE_MS + (resultado.compilado ? 0 : 6000));   // compilar puede tardar más la primera vez
      };
      const al = ({ data }) => {
        if (data.tipo === 'compilado') { resultado.compilado = data; eventos.compilado?.(data); vigilar(); }
        if (data.tipo === 'llamada') { resultado.llamadas.set(data.id, data); eventos.llamada?.(data); vigilar(); }
        if (data.tipo === 'fin') { clearTimeout(reloj); this.worker.removeEventListener('message', al); fin(resultado); }
      };
      this.worker.addEventListener('message', al);
      this.detener = () => { clearTimeout(reloj); this.worker.removeEventListener('message', al); resultado.detenido = 'usuario'; this.crear(); fin(resultado); };
      vigilar();
      this.worker.postMessage(trabajo);
    });
  }
}
