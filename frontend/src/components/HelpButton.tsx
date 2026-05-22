import React, { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';

const tutorials: Record<string, { title: string, content: React.ReactNode }> = {
  '/': {
    title: 'Guia do Dashboard',
    content: (
      <>
        <p>Bem-vindo ao Emma's Librarian! Este é o seu painel principal.</p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <li><strong>Projetos:</strong> Aqui você vê todos os seus projetos de pesquisa. Cada card exibe um resumo da quantidade de artigos do projeto (Lidos, Novos/Ativos e Arquivados).</li>
          <li><strong>Novo Projeto:</strong> Clique no botão "Novo Projeto" no canto superior direito para iniciar uma nova pesquisa bibliográfica.</li>
        </ul>
      </>
    )
  },
  'project-details': {
    title: 'Guia do Projeto',
    content: (
      <>
        <p>Nesta página você gerencia os artigos do seu projeto e acompanha o progresso da revisão.</p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <li><strong>Nova Busca:</strong> Clique para procurar novos artigos nas bases de dados conectadas.</li>
          <li><strong>Filtros e Status:</strong> Use as abas para alternar entre artigos novos, em revisão e aprovados.</li>
          <li><strong>Leitura:</strong> Clique no título de um artigo para abrir o Leitor de PDF e fazer anotações.</li>
          <li><strong>Exportar:</strong> Você pode exportar as referências para o Biblioshiny usando o botão no topo da tela.</li>
          <li><strong>Diário:</strong> Uma aba dedicada para registrar decisões metodológicas, ideias e notas de pesquisa que ficam vinculadas à data atual.</li>
          <li><strong>Histórico de Buscas:</strong> Veja um registro das últimas pesquisas feitas para garantir rastreabilidade.</li>
        </ul>
      </>
    )
  },
  'search': {
    title: 'Guia de Busca',
    content: (
      <>
        <p>Esta é a ferramenta de busca federada. Ela permite pesquisar em várias bases de dados ao mesmo tempo usando uma única interface.</p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <li><strong>Bases de Dados:</strong> Selecione as bases que deseja consultar. (Lembre-se de adicionar as chaves de API nas configurações para Scopus e Web of Science).</li>
          <li><strong>Construtor Visual:</strong> Crie regras de busca (ex: Título contém "IA" E Resumo contém "Saúde").</li>
          <li><strong>Tradução Automática:</strong> O Emma's Librarian traduz automaticamente a sua regra para a sintaxe específica de cada base (ex: Scopus usa TITLE-ABS-KEY, PubMed usa [Title/Abstract]).</li>
          <li><strong>Limites:</strong> Fique atento aos limites de cada API descritos abaixo do campo de quantidade.</li>
        </ul>
      </>
    )
  },
  'reader': {
    title: 'Guia do Leitor de PDF',
    content: (
      <>
        <p>O Leitor de PDF permite que você estude e faça fichamentos sem sair do Emma's Librarian.</p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <li><strong>Upload:</strong> Se o artigo não tiver PDF, clique em "Vincular PDF Local" para fazer o upload do arquivo do seu computador.</li>
          <li><strong>Destaques:</strong> Selecione qualquer texto no PDF e um menu aparecerá permitindo adicionar um comentário e destacar o texto (fichamento).</li>
          <li><strong>Anotações Avulsas:</strong> Na barra lateral, você pode adicionar notas gerais que não estão ligadas a um texto específico.</li>
          <li><strong>Busca Inteligente:</strong> Use a aba "Pesquisar" na barra lateral para encontrar termos no documento. Os termos serão destacados no texto.</li>
        </ul>
      </>
    )
  },
  '/settings': {
    title: 'Guia de Configurações',
    content: (
      <>
        <p>Aqui você pode configurar integrações externas.</p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <li><strong>Chaves de API:</strong> Adicione suas credenciais institucionais para bases como Scopus e Web of Science para poder realizar buscas através do Emma's Librarian.</li>
          <li>As chaves ficam salvas apenas localmente no seu computador.</li>
        </ul>
      </>
    )
  },
  '/new': {
    title: 'Novo Projeto',
    content: (
      <>
        <p>Crie um novo projeto de revisão sistemática.</p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <li><strong>Nome:</strong> Dê um nome claro para o seu projeto (ex: "Revisão sobre IA na Saúde 2024").</li>
          <li><strong>Descrição:</strong> Adicione os objetivos, critérios de inclusão e exclusão da sua revisão para referência futura.</li>
        </ul>
      </>
    )
  }
};

export const HelpModal: React.FC<{ isOpen: boolean, onClose: () => void, pageKey: string }> = ({ isOpen, onClose, pageKey }) => {
  if (!isOpen) return null;

  const tutorial = tutorials[pageKey] || {
    title: 'Ajuda',
    content: <p>Nenhum guia específico encontrado para esta página.</p>
  };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
      <div className="card fade-in" style={{ width: '100%', maxWidth: '600px', background: 'var(--bg-surface)', padding: '2.5rem', position: 'relative' }}>
        <button 
          onClick={onClose}
          style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
        >
          <X size={24} />
        </button>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', color: 'var(--color-primary)', padding: '0.5rem', borderRadius: '50%', display: 'flex' }}>
            <HelpCircle size={28} />
          </div>
          <h2 style={{ fontSize: '1.5rem', margin: 0, color: 'var(--text-heading)' }}>
            {tutorial.title}
          </h2>
        </div>
        
        <div style={{ color: 'var(--text-main)', lineHeight: '1.6' }}>
          {tutorial.content}
        </div>
        
        <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-primary" style={{ padding: '0.5rem 1.5rem' }}>
            Entendi
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const HelpButton: React.FC<{ forcePageKey?: string, style?: React.CSSProperties }> = ({ forcePageKey, style }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  let pageKey = location.pathname;
  if (forcePageKey) {
    pageKey = forcePageKey;
  } else if (location.pathname.startsWith('/projects/') && location.pathname.includes('/search')) {
    pageKey = 'search';
  } else if (location.pathname.startsWith('/projects/')) {
    pageKey = 'project-details';
  } else if (location.pathname.startsWith('/articles/')) {
    pageKey = 'reader';
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="btn-secondary"
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem', 
          padding: '0.5rem 1rem',
          color: 'var(--color-primary)',
          borderColor: 'color-mix(in srgb, var(--color-primary) 20%, transparent)',
          background: 'color-mix(in srgb, var(--color-primary) 5%, transparent)',
          ...style
        }}
        title="Ajuda sobre esta página"
      >
        <HelpCircle size={18} />
        Ajuda
      </button>
      <HelpModal isOpen={isOpen} onClose={() => setIsOpen(false)} pageKey={pageKey} />
    </>
  );
};
