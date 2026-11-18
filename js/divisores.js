// Columnas de ancho ajustable: se arrastran los divisores (doble clic oculta o muestra la columna).
// Los anchos se guardan en el navegador.

const CLAVE = 'ide-c:anchos';
const MIN = 160;

export function activarDivisores(grilla, alCambiar = () => {}) {
  let anchos = { izq: 280, der: 420, izqOculta: false, derOculta: false };
  try { Object.assign(anchos, JSON.parse(localStorage.getItem(CLAVE) || '{}')); } catch { /* sin almacenamiento */ }

  const aplicar = () => {
    if (innerWidth <= 1000) { alCambiar(); return; }   // celular: una columna (pestañas); no se tocan los anchos guardados
    const max = Math.max(MIN, grilla.clientWidth - 360);   // el editor conserva al menos ~360 px
    anchos.izq = Math.min(Math.max(anchos.izq, MIN), max);
    anchos.der = Math.min(Math.max(anchos.der, MIN), max);
    grilla.style.setProperty('--izq', anchos.izqOculta ? '0px' : anchos.izq + 'px');
    grilla.style.setProperty('--der', anchos.derOculta ? '0px' : anchos.der + 'px');
    grilla.classList.toggle('sin-izq', anchos.izqOculta);
    grilla.classList.toggle('sin-der', anchos.derOculta);
    try { localStorage.setItem(CLAVE, JSON.stringify(anchos)); } catch { /* sin almacenamiento */ }
    alCambiar();
  };

  for (const d of grilla.querySelectorAll('.divisor')) {
    const col = d.dataset.col;
    d.addEventListener('pointerdown', e => {
      e.preventDefault();
      d.setPointerCapture(e.pointerId);
      const x0 = e.clientX, oculta = anchos[col + 'Oculta'], w0 = oculta ? 0 : anchos[col];
      d.classList.add('arrastrando');
      const mover = ev => {
        const dx = ev.clientX - x0;
        if (Math.abs(dx) < 4) return;   // un clic (o doble clic) no cambia el ancho
        anchos[col + 'Oculta'] = false;
        anchos[col] = col === 'izq' ? w0 + dx : w0 - dx;
        aplicar();
      };
      const soltar = () => { d.classList.remove('arrastrando'); d.removeEventListener('pointermove', mover); d.removeEventListener('pointerup', soltar); };
      d.addEventListener('pointermove', mover);
      d.addEventListener('pointerup', soltar);
    });
    d.addEventListener('dblclick', () => { anchos[col + 'Oculta'] = !anchos[col + 'Oculta']; aplicar(); });
  }
  addEventListener('resize', aplicar);
  aplicar();
}
