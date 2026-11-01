import React from 'react';

const LIST: React.CSSProperties = {
  paddingLeft: '1.5rem',
  marginTop: '0.5rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const Term: React.FC<{ name: string; children: React.ReactNode }> = ({ name, children }) => (
  <li>
    <strong>{name}:</strong> {children}
  </li>
);

const PT_DOI = 'https://doi.org/10.5123/S1679-49742022000200033';

/**
 * The help of the systematic review page: how the screening works and every PRISMA 2020 term the diagram uses,
 * in the words of the official Brazilian Portuguese translation (user request on the #50 prototype).
 */
export const REVIEW_HELP: { title: string; content: React.ReactNode } = {
  title: 'Guia da Revisão Sistemática',
  content: (
    <>
      <p>
        Nesta página você faz a triagem dos artigos do projeto e acompanha o diagrama PRISMA 2020, o fluxograma que os
        periódicos pedem em revisões sistemáticas. Os termos abaixo seguem a tradução oficial da PRISMA para o
        português.
      </p>
      <h3 style={{ fontSize: '1rem', margin: '1rem 0 0' }}>Triagem</h3>
      <ul style={LIST}>
        <Term name="Rótulos">
          Cada decisão é um rótulo de inclusão, exclusão, dúvida ou duplicado. Um rótulo de exclusão também é o motivo
          que aparece no diagrama. Excluir na triagem arquiva o artigo no projeto.
        </Term>
        <Term name="Duas etapas">
          Primeiro título e resumo; quem passa segue para o texto completo, onde se decide de vez.
        </Term>
      </ul>
      <h3 style={{ fontSize: '1rem', margin: '1rem 0 0' }}>Termos da PRISMA</h3>
      <ul style={LIST}>
        <Term name="Registro">
          O título ou resumo (ou ambos) de uma publicação, como aparece numa base de dados ou num site.
        </Term>
        <Term name="Publicação">
          Qualquer documento com informação sobre um estudo: artigo, preprint, resumo de congresso, tese, relatório
          técnico.
        </Term>
        <Term name="Estudo">
          A pesquisa em si. Um estudo pode ter várias publicações, como o preprint e o artigo publicado. Marque-as como
          "mesmo estudo" na caixa de incluídos e o app conta os estudos sozinho.
        </Term>
        <Term name="Duplicado">
          A mesma publicação vinda mais de uma vez. Publicações apenas parecidas (o mesmo resumo em dois congressos)
          contam como registros diferentes, e um preprint e o artigo publicado são publicações do mesmo estudo, não
          duplicados.
        </Term>
        <Term name="Bases de dados e repositórios">
          A coluna da esquerda: os registros das buscas estruturadas do app, base por base, antes de tirar duplicados.
        </Term>
        <Term name="Outros métodos">
          A coluna da direita, que só aparece quando há artigos de fora das buscas: adicionados à mão, importados de
          PDFs ou de outro projeto. Cada um ganha uma origem (buscas por citações, sites e buscadores, organizações,
          outros projetos do app ou outros). Um site é onde você encontrou a publicação, não a publicação. Esta coluna
          não tem triagem por título nem caixa de duplicados, como no modelo.
        </Term>
        <Term name="Registros triados">Os registros das buscas que passam pela triagem por título e resumo.</Term>
        <Term name="Publicações recuperadas e não recuperadas">
          As que seguem para o texto completo, e as que você não conseguiu obter (rótulo "Texto completo não
          recuperado").
        </Term>
        <Term name="Publicações avaliadas para elegibilidade">Os textos completos lidos e decididos.</Term>
        <Term name="Publicações excluídas">
          Excluídas no texto completo, com o motivo. A exportação leva a lista delas com a referência de cada uma, como
          pede o item 16b da PRISMA.
        </Term>
        <Term name="Incluído">Dois números: estudos incluídos na revisão e publicações desses estudos.</Term>
      </ul>
      <h3 style={{ fontSize: '1rem', margin: '1rem 0 0' }}>Avisos do diagrama</h3>
      <ul style={LIST}>
        <Term name="Aguardando decisões">
          Ainda há artigos em dúvida, sem decisão ou sem origem. Os números estão certos; a conta fecha quando você
          decidir.
        </Term>
        <Term name="Números não batem">
          Dois números que deveriam ser iguais não são, por exemplo após apagar artigos.
        </Term>
        <Term name="Busca pode ser parcial">
          Uma base devolveu exatamente o limite pedido: pode haver mais resultados.
        </Term>
        <Term name="Sem dados para conferir">
          Uma busca antiga, salva antes de o app guardar quantos resultados eram únicos.
        </Term>
      </ul>
      <p style={{ marginTop: '1rem' }}>
        O app nunca corrige um número sozinho. Referência do modelo:{' '}
        <a href={PT_DOI} target="_blank" rel="noreferrer">
          A declaração PRISMA 2020 (tradução oficial)
        </a>
        .
      </p>
    </>
  ),
};
