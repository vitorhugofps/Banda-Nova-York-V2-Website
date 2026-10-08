/* Página de privacidade: apagar o rascunho do formulário e a lista de vídeos guardados neste aparelho. */
(function () {
  var b = document.querySelector('[data-apagar]'), ok = document.querySelector('[data-apagar-ok]');
  if (!b) return;
  b.hidden = false;
  b.addEventListener('click', function () {
    try {
      ['ny-form-draft-v2', 'ny-form-draft', 'ny-videos-v1', 'ny-first'].forEach(function (k) { localStorage.removeItem(k); });
      sessionStorage.removeItem('ny-last');
      ok.textContent = 'Pronto. Os dados guardados neste aparelho foram apagados.';
    } catch (e) {
      ok.textContent = 'Este navegador não permite acessar os dados locais. Nada ficou guardado.';
    }
  });
})();
