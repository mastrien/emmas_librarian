/**
 * Ampliar ao clicar: as capturas de tela ficam pequenas na coluna da página, com o texto da interface ilegível.
 * Um clique (ou Enter) numa imagem de `.feature-visual` ou `.tutorial-img` abre a mesma imagem em tamanho grande; Esc, o X e um clique
 * fora da imagem fecham.
 */
(function () {
    var dialog = document.getElementById('lightbox');
    if (!dialog || typeof dialog.showModal !== 'function') return;
    var big = dialog.querySelector('img');

    function open(image) {
        big.src = image.currentSrc || image.src;
        big.alt = image.alt;
        dialog.showModal();
    }

    document.querySelectorAll('.feature-visual img, .tutorial-img').forEach(function (image) {
        image.tabIndex = 0;
        image.setAttribute('role', 'button');
        image.setAttribute('aria-label', 'Ampliar: ' + image.alt);
        image.addEventListener('click', function () { open(image); });
        image.addEventListener('keydown', function (event) {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            open(image);
        });
    });

    dialog.querySelector('.lightbox-close').addEventListener('click', function () { dialog.close(); });
    // O clique no fundo escuro cai no próprio <dialog>, não na imagem.
    dialog.addEventListener('click', function (event) { if (event.target === dialog) dialog.close(); });
})();
