            }
        }
    }),
    [`url`, `bold`, `italic`, `strike`].forEach(function(t) {
        [`url`, `bold`, `italic`, `strike`, `code-snippet`].forEach(function(n) {
            t !== n && (e.languages.markdown[t].inside.content.inside[n] = e.languages.markdown[n]) [ERRO NESSA LINHA]
        })
    }),
    e.hooks.add(`after-tokenize`, function(e) {
        if (e.language !== `markdown` && e.language !== `md`)
            return;