// Guías de FQ Solution — listas de verificación interactivas.
// Sin almacenamiento: las marcas viven solo en la página abierta. Compatible con CSP estricta.
document.querySelectorAll('[data-verificacion]').forEach((box) => {
  const items = Array.from(box.querySelectorAll('input[type="checkbox"]'));
  const hechos = box.querySelector('[data-hechos]');
  const total = box.querySelector('[data-total]');
  const barra = box.querySelector('progress');
  const aviso = box.querySelector('[data-aviso]');

  function actualizar() {
    const n = items.filter((i) => i.checked).length;
    if (hechos) hechos.textContent = String(n);
    if (barra) barra.value = n;
    if (aviso) aviso.textContent = n === items.length ? 'Todo listo: el local puede abrir.' : '';
  }

  if (total) total.textContent = String(items.length);
  if (barra) barra.max = items.length;
  items.forEach((i) => i.addEventListener('change', actualizar));

  const reiniciar = box.querySelector('[data-reiniciar]');
  if (reiniciar) reiniciar.addEventListener('click', () => { items.forEach((i) => { i.checked = false; }); actualizar(); });

  const imprimir = box.querySelector('[data-imprimir]');
  if (imprimir) imprimir.addEventListener('click', () => window.print());

  actualizar();
});
