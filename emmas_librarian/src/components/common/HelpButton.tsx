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
          <li><strong>Projetos:</strong> Aqui você vê todos os seus projetos de pesquisa. Cada card exibe um resumo da quantidade de artigos do projeto (Lidos, Ativos e Arquivados).</li>
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
          <li><strong>Categorias:</strong> Crie categorias personalizadas (texto, múltipla escolha, sim/não) para classificar os artigos da sua revisão clicando no botão "Gerenciar Categorias".</li>
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
          <li><strong>Categorização Rápida:</strong> Clique no botão de Categorias flutuante (canto inferior esquerdo) para preencher as categorias deste artigo sem sair da tela.</li>
          <li><strong>Barra Lateral:</strong>
            <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <li><strong>Anotações:</strong> Veja e edite seus destaques e anotações avulsas.</li>
              <li><strong>Pesquisar:</strong> Encontre termos no documento (os resultados serão destacados em amarelo no PDF).</li>
              <li><strong>Insights IA:</strong> Gere resumos automáticos (Geral e por Seção) usando a chave de API configurada.</li>
              <li><strong>Rascunho:</strong> Um bloco de notas vinculado ao projeto que salva automaticamente enquanto você digita.</li>
            </ul>
          </li>
        </ul>
      </>
    )
  },
  '/settings': {
    title: 'Guia de Configurações e APIs',
    content: (
      <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '1rem' }}>
        <p>Aqui você pode configurar integrações externas para buscas e análises com Inteligência Artificial.</p>
        
        <h4 style={{ color: 'var(--color-primary)', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Bases de Dados (Scopus e Web of Science)</h4>
        <ul style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <li>As chaves para bases bibliográficas geralmente são obtidas pelos portais institucionais ou de desenvolvedores (ex: Elsevier Developer Portal para Scopus).</li>
          <li>As chaves ficam salvas apenas localmente no seu computador.</li>
        </ul>

        <h4 style={{ color: 'var(--color-primary)', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Modelos de IA em Nuvem (OpenAI, Gemini, Claude)</h4>
        <ul style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <li><strong>OpenAI:</strong> Acesse <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)' }}>platform.openai.com</a>, faça login, vá em "API keys" e gere uma nova chave.</li>
          <li><strong>Google Gemini:</strong> Acesse o <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)' }}>Google AI Studio</a>, clique em "Get API key" e crie sua chave.</li>
          <li><strong>Anthropic Claude:</strong> Acesse <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)' }}>console.anthropic.com</a> para gerar sua chave.</li>
        </ul>

        <h4 style={{ color: 'var(--color-primary)', marginTop: '1.5rem', marginBottom: '0.5rem' }}>Modelos Locais com Ollama (Privacidade Total)</h4>
        <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>O Ollama permite rodar modelos avançados de IA (como Llama 3) no seu próprio computador, sem internet e sem custo.</p>
        <ol style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
          <li>Baixe e instale o Ollama acessando <a href="https://ollama.com" target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)' }}>ollama.com</a>.</li>
          <li>Abra o seu terminal (Prompt de Comando ou PowerShell).</li>
          <li>Execute o comando <code style={{ background: 'var(--bg-main)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>ollama run llama3</code> (ou o modelo desejado). Isso irá baixar e iniciar o modelo.</li>
          <li>O Ollama ficará rodando no endereço padrão (http://localhost:11434).</li>
          <li>No Emma's Librarian, preencha a chave de API do Ollama com o IP do seu servidor (por padrão: <code style={{ background: 'var(--bg-main)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>http://127.0.0.1:11434</code>) e o Nome do Modelo (ex: <code style={{ background: 'var(--bg-main)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>llama3</code>).</li>
        </ol>
      </div>
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
