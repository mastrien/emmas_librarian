/**
 * Sumário do capítulo aberto, na coluna da direita: lista os subtítulos (h3) do capítulo e marca o que está na tela.
 * Os links `#id` são tratados pelo script da página (tutoriais.html), que já rola até o ponto dentro do capítulo.
 *
 * Uso: ChapterToc.show(document.getElementById('intro'));
 */
(function () {
    var box = document.getElementById('chapter-toc');
    var list = document.getElementById('toc-list');
    if (!box || !list) return;

    // Quanto do topo da janela conta como "já passei desse subtítulo".
    var READING_LINE = 140;
    var headings = [];

    function slugOf(text) {
        return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'secao';
    }

    // Subtítulos sem id ganham um; um id já usado por outro elemento da página recebe um número.
    function ensureId(heading) {
        if (heading.id) return heading.id;
        var base = slugOf(heading.textContent);
        var id = base;
        for (var n = 2; document.getElementById(id); n++) id = base + '-' + n;
        heading.id = id;
        return id;
    }

    function itemFor(heading) {
        var item = document.createElement('li');
        var link = document.createElement('a');
        link.href = '#' + ensureId(heading);
        link.textContent = heading.textContent;
        item.appendChild(link);
        return item;
    }

    function markCurrent() {
        var current = null;
        headings.forEach(function (heading) {
            if (heading.getBoundingClientRect().top <= READING_LINE) current = heading.id;
        });
        list.querySelectorAll('a').forEach(function (link) {
            link.classList.toggle('active', link.getAttribute('href') === '#' + current);
        });
    }

    function show(section) {
        headings = Array.prototype.slice.call(section.querySelectorAll('h3'));
        list.textContent = '';
        headings.forEach(function (heading) { list.appendChild(itemFor(heading)); });
        // Um capítulo com um só subtítulo não precisa de sumário.
        box.hidden = headings.length < 2;
        markCurrent();
    }

    window.addEventListener('scroll', markCurrent, { passive: true });
    window.ChapterToc = { show: show };
})();
