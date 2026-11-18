// Editor con pestañas de archivo, sobre CodeMirror 5 (cargado como script global).
/* global CodeMirror */

export class Editor {
  // contenedor: elemento donde va el editor; pestanas: barra de pestañas de archivo
  constructor(contenedor, pestanas, { alCambiar } = {}) {
    this.pestanas = pestanas;
    this.docs = new Map();      // nombre → {doc, editable}
    this.actual = null;
    this.alCambiar = alCambiar;
    this.cm = CodeMirror(contenedor, {
      mode: 'text/x-csrc', lineNumbers: true, indentUnit: 4, tabSize: 4,
      // textarea también en el celular: así «sin teclado» (solo lectura) no abre el teclado al tocar
      inputStyle: 'textarea',
      matchBrackets: true, autoCloseBrackets: true, styleActiveLine: true,
      extraKeys: { Tab: cm => cm.execCommand(cm.somethingSelected() ? 'indentMore' : 'insertSoftTab') },
    });
  }

  // archivos: [{nombre, texto, editable}]
  cargar(archivos) {
    this.docs.clear();
    for (const a of archivos) {
      const doc = CodeMirror.Doc(a.texto, 'text/x-csrc');
      doc.on('change', () => this.alCambiar?.(a.nombre, doc.getValue()));
      this.docs.set(a.nombre, { doc, editable: a.editable });
    }
    this.dibujarPestanas();
    this.abrir(archivos[0].nombre);
  }

  dibujarPestanas() {
    this.pestanas.innerHTML = '';
    for (const [nombre, { editable }] of this.docs) {
      const b = document.createElement('button');
      b.className = 'archivo' + (nombre === this.actual ? ' activo' : '');
      b.textContent = (editable ? '' : '🔒 ') + nombre;
      b.title = editable ? 'Puedes editar este archivo' : 'Solo lectura';
      b.onclick = () => this.abrir(nombre);
      this.pestanas.appendChild(b);
    }
  }

  abrir(nombre, linea) {
    const d = this.docs.get(nombre);
    if (!d) return false;
    this.actual = nombre;
    this.cm.swapDoc(d.doc);
    this.cm.setOption('readOnly', !d.editable ? 'nocursor' : this.sinTeclado ? true : false);
    this.dibujarPestanas();
    if (linea) {
      this.cm.setCursor({ line: linea - 1, ch: 0 });
      this.cm.scrollIntoView({ line: linea - 1, ch: 0 }, 80);
    }
    this.cm.refresh();
    if (d.editable) this.cm.focus();
    return true;
  }

  texto(nombre) { return this.docs.get(nombre)?.doc.getValue() ?? ''; }
  poner(nombre, texto) { this.docs.get(nombre)?.doc.setValue(texto); }

  // Marca las líneas con error (se limpian al volver a compilar).
  marcarErrores(errores) {
    for (const { doc } of this.docs.values())
      for (let i = 0; i < doc.lineCount(); i++) doc.removeLineClass(i, 'background', 'linea-error');
    for (const e of errores) {
      const d = this.docs.get(e.archivo);
      if (d && e.linea) d.doc.addLineClass(e.linea - 1, 'background', 'linea-error');
    }
  }

  refrescar() { this.cm.refresh(); }

  // Marca (o desmarca, con linea null) la línea que se está ejecutando en la visualización.
  marcarEjecucion(nombre, linea) {
    if (this.marca) { this.marca.doc.removeLineClass(this.marca.linea, 'background', 'linea-ejecucion'); this.marca = null; }
    if (!linea) return;
    const d = this.docs.get(nombre);
    if (!d) return;
    if (this.actual !== nombre) this.abrir(nombre);
    d.doc.addLineClass(linea - 1, 'background', 'linea-ejecucion');
    this.marca = { doc: d.doc, linea: linea - 1 };
    this.cm.scrollIntoView({ line: linea - 1, ch: 0 }, 60);
  }

  // Tamaño de letra (px) del código; también lo usan el asistente y los tests (variable --letra).
  letra(px) {
    document.documentElement.style.setProperty('--letra', px + 'px');
    this.cm.refresh();
  }
  ajustar(si) { this.cm.setOption('lineWrapping', si); }

  // Sin teclado: el archivo editable queda de solo lectura para el usuario (tocar solo mueve el
  // cursor y no abre el teclado del celular); los comandos del asistente igual lo modifican.
  teclado(si) {
    this.sinTeclado = !si;
    const d = this.docs.get(this.actual);
    if (d) this.cm.setOption('readOnly', !d.editable ? 'nocursor' : this.sinTeclado ? true : false);
  }
}
