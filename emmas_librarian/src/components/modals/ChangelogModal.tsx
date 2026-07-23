import React from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, AlertCircle } from 'lucide-react';

interface ChangelogModalProps {
  isOpen: boolean;
  version: string;
  onClose: () => void;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, version, onClose }) => {
  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
      }}
    >
      <div
        className="card fade-in"
        style={{
          width: '550px',
          maxWidth: '95%',
          maxHeight: '90vh',
          background: 'var(--bg-main)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '2rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '1.5rem',
            }}
          >
            <div>
              <h2 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles className="text-primary" size={24} color="var(--color-primary)" />
                Novidades da Versão {version}
              </h2>
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>Veja o que mudou no Emma's Librarian.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <h3
                style={{
                  marginTop: 0,
                  marginBottom: '0.75rem',
                  fontSize: '1.1rem',
                  color: 'var(--color-primary)',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '0.25rem',
                }}
              >
                Versão 1.1.19 — Agenda & Prazos
              </h3>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  color: 'var(--text-main)',
                  fontSize: '0.95rem',
                }}
              >
                <li>
                  <strong>Agenda & Prazos Globais:</strong> Novo módulo de gerenciamento de eventos, conferências e periódicos com suporte a múltiplos prazos customizáveis.
                </li>
                <li>
                  <strong>Intervalos & Prazos Pontuais:</strong> Suporte a prazos com datas únicas ou intervalos com validação de vencimento baseada na data final.
                </li>
                <li>
                  <strong>Visualizações Flexíveis:</strong> Modos de pílula unificada para alternar entre "Por Evento/Revista" e "Lista de Prazos", além de calendário integrado.
                </li>
                <li>
                  <strong>Dashboard Minimalista:</strong> Seção superior com relógio grande em cores neutras e banner de próximos prazos com atualização local otimizada.
                </li>
              </ul>
            </div>

            <div>
              <h3
                style={{
                  marginTop: 0,
                  marginBottom: '0.75rem',
                  fontSize: '1.1rem',
                  color: 'var(--color-primary)',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '0.25rem',
                }}
              >
                Versão 1.1.18
              </h3>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  color: 'var(--text-main)',
                  marginBottom: '1.5rem',
                }}
              >
                <li>
                  <strong>Edição de Acesso Rápido:</strong> Edite atalhos já cadastrados (título, URL, arquivo PDF ou grupo) diretamente pelo modal de gerenciamento.
                </li>
                <li>
                  <strong>Reordenação por Arraste com Indicador Guia:</strong> Reorganize a ordem dos seus atalhos segurando a alça de 6 pontos com indicador visual dinâmico no vão de inserção.
                </li>
                <li>
                  <strong>Grupos Nomeados e Organização no Topo:</strong> Organize atalhos por grupos nomeados com exibição prioritária dos itens gerais no topo da seção.
                </li>
              </ul>

              <h3
                style={{
                  margin: '0 0 0.75rem 0',
                  color: 'var(--color-primary)',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '0.25rem',
                }}
              >
                Versão 1.1.17
              </h3>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  color: 'var(--text-main)',
                }}
              >
                <li>
                  <strong>Interface Limpa & Agrupamento de Ações:</strong> Menu de navegação principal e botões de ação do projeto organizados em dropdowns expansíveis por movimento do mouse (hover) com transições suaves.
                </li>
                <li>
                  <strong>Correção de Importação de PDFs entre Projetos:</strong> Solucionado o erro no banco de dados SQLite ao clonar artigos com PDFs anexados e embeddings vetoriais entre projetos.
                </li>
                <li>
                  <strong>Organização da Biblioteca Global de PDFs:</strong> Arquivos salvos com marca d'água de data e nome original (`YYYYMMDD_HHMMSS_nome.pdf`), com layout da tabela aprimorado para telas menores.
                </li>
                <li>
                  <strong>Estabilidade na Suíte E2E:</strong> Testes End-to-End no Playwright 100% parametrizados e homologados.
                </li>
              </ul>
            </div>

            <div>
              <h3
                style={{
                  margin: '0 0 0.75rem 0',
                  color: 'var(--color-primary)',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '0.25rem',
                }}
              >
                Versão 1.1.16
              </h3>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  color: 'var(--text-main)',
                }}
              >
                <li>
                  <strong>Histórico de Parâmetros de Busca:</strong> O critério de ordenação e o limite máximo de
                  resultados selecionados para cada busca agora são persistidos no banco de dados e exibidos no
                  histórico de buscas, garantindo total transparência e reprodutibilidade nos termos pesquisados.
                </li>
                <li>
                  <strong>Sincronização Avançada:</strong> Os novos campos de ordenação e limite do histórico de buscas
                  são totalmente preservados e reconstruídos nos processos de exportação e importação de projetos.
                </li>
              </ul>
            </div>

            <div>
              <h3
                style={{
                  margin: '0 0 0.75rem 0',
                  color: 'var(--color-primary)',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '0.25rem',
                }}
              >
                Versão 1.1.15
              </h3>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  color: 'var(--text-main)',
                }}
              >
                <li>
                  <strong>Histórico Completo na Extração Massiva:</strong> Artigos cancelados, não executados ou com
                  falhas no loop da extração massiva agora são devidamente registrados com o status correspondente (como{' '}
                  <code>skipped</code> ou <code>error</code>) no banco de dados. Isso garante que todos os artigos
                  selecionados apareçam na visualização de detalhes no histórico.
                </li>
                <li>
                  <strong>Identificação Dinâmica do Modelo de IA:</strong> O modelo e provedor salvos no histórico de
                  investigações massivas agora são resolvidos dinamicamente de acordo com o modelo ativo selecionado
                  para a habilidade de extração (ex: <code>Gemini (gemini-1.5-pro)</code>), em vez de uma checagem
                  estática de chaves de API.
                </li>
              </ul>
            </div>

            <div>
              <h3
                style={{
                  margin: '0 0 0.75rem 0',
                  color: 'var(--color-primary)',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '0.25rem',
                }}
              >
                Versão 1.1.14
              </h3>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  color: 'var(--text-main)',
                }}
              >
                <li>
                  <strong>Correção de Recurso Local em Produção:</strong> Correção do erro
                  <code>Not allowed to load local resource</code> ao abrir o aplicativo empacotado. O carregamento do{' '}
                  <code>index.html</code> e do ícone agora utilizam a API
                  <code>app.getAppPath()</code> para localizar corretamente os arquivos na raiz.
                </li>
              </ul>
            </div>

            <div>
              <h3
                style={{
                  margin: '0 0 0.75rem 0',
                  color: 'var(--color-primary)',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '0.25rem',
                }}
              >
                Versão 1.1.13
              </h3>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  color: 'var(--text-main)',
                }}
              >
                <li>
                  <strong>Categorias de Seleção Múltipla:</strong> As categorias do tipo enum e multiselect agora usam
                  um modelo relacional, permitindo renomear e reordenar opções sem perder dados históricos dos artigos.
                </li>
                <li>
                  <strong>Sets de Perguntas:</strong> Crie, reutilize e duplique conjuntos de perguntas para
                  investigações em IA, com suporte a escopo global e por projeto.
                </li>
                <li>
                  <strong>Resultados de Investigação Granulares:</strong> Cada resposta gerada pela IA em investigações
                  massivas agora é armazenada individualmente, permitindo visualização e exportação por artigo e
                  pergunta.
                </li>
                <li>
                  <strong>Configuração de Modelos de IA:</strong> Novo painel para selecionar provider e modelo por
                  habilidade (metadados, resumo, extração, embeddings) com suporte a OpenAI, Gemini, Anthropic e Ollama.
                </li>
                <li>
                  <strong>Export/Import Completo (.emmapcarc):</strong> A transferência de projetos entre computadores
                  agora inclui seleções de categorias, sets de perguntas e resultados de investigação, sem perda de
                  dados.
                </li>
                <li>
                  <strong>RAG e Busca Semântica:</strong> Infraestrutura de chunks de PDF e embeddings vetoriais para
                  respostas contextualizadas com citação de trecho e página.
                </li>
              </ul>
            </div>

            <div>
              <h3
                style={{
                  margin: '0 0 0.75rem 0',
                  color: 'var(--color-primary)',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '0.25rem',
                }}
              >
                Versão 1.1.12
              </h3>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  color: 'var(--text-main)',
                }}
              >
                <li>
                  <strong>Sistema de Backup e Lixeira:</strong> Implementação completa de backups automáticos (rotação
                  GFS) e lixeira para recuperação segura de projetos, artigos e anotações.
                </li>
                <li>
                  <strong>Histórico do Diário:</strong> O diário do projeto agora armazena versões passadas, permitindo
                  a restauração de textos anteriores diretamente pela interface.
                </li>
                <li>
                  <strong>Integridade de Importação/Exportação:</strong> Resolução de falhas que causavam perda de dados
                  de categorias e histórico ao mover projetos entre computadores via arquivos `.emmapcarc`.
                </li>
                <li>
                  <strong>Correções de Banco de Dados:</strong> Otimização da persistência (checkpointing WAL) e
                  tratamento de erros de colunas inexistentes em migrações automáticas.
                </li>
                <li>
                  <strong>Melhorias de UI:</strong> Novos modais de restauração, botões de lixeira estilizados e
                  feedbacks visuais aprimorados.
                </li>
              </ul>
            </div>

            <div>
              <h3
                style={{
                  margin: '0 0 0.75rem 0',
                  color: 'var(--color-primary)',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '0.25rem',
                }}
              >
                Versão 1.1.11
              </h3>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  color: 'var(--text-main)',
                }}
              >
                <li>
                  <strong>Controle de "et al." em Citações:</strong> Adicionado checkbox nos modais de citação
                  individual e em massa para ativar/desativar o uso de "et al." na lista de autores.
                </li>
                <li>
                  <strong>Leitura de Autores por Vírgulas:</strong> Correção do parser de autores para suportar
                  adequadamente nomes separados por vírgula em metadados importados.
                </li>
                <li>
                  <strong>Instruções de Preenchimento:</strong> Inclusão de textos de ajuda explicativos sobre o padrão
                  de identificação de múltiplos autores nos formulários de cadastro e edição.
                </li>
                <li>
                  <strong>Padronização de Accordions:</strong> Ajuste visual e estrutural completo dos ícones dinâmicos
                  (`ChevronRight`/`ChevronDown`) e remoção das setas nativas do navegador nos accordions de artigos
                  lidos e arquivados.
                </li>
                <li>
                  <strong>Ajustes de Rolagem:</strong> Correção do transbordo da barra de rolagem nas bordas
                  arredondadas do modal de citação em massa.
                </li>
              </ul>
            </div>

            <div>
              <h3
                style={{
                  margin: '0 0 0.75rem 0',
                  color: 'var(--color-primary)',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '0.25rem',
                }}
              >
                Versão 1.1.10
              </h3>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  color: 'var(--text-main)',
                }}
              >
                <li>
                  <strong>Melhoria de Layout nos Modais:</strong> Correção do transbordo da barra de rolagem (clipping
                  do scrollbar) nas bordas arredondadas nos modais do sistema.
                </li>
                <li>
                  <strong>Rolagem de Resumo e Referências:</strong> Remoção da rolagem interna nas caixas de resumo e
                  referências, integrando-as à rolagem global do modal.
                </li>
                <li>
                  <strong>Padronização de Status de Artigos:</strong> Renomeação do filtro "Novos" para "Ativos",
                  unificando a nomenclatura do sistema.
                </li>
                <li>
                  <strong>Ações Contextuais de Artigos:</strong> Exibição inteligente de botões como "Desmarcar" e
                  "Restaurar" de acordo com o status atual do artigo.
                </li>
                <li>
                  <strong>Mais Opções para Artigos Lidos:</strong> Adição de botões para abrir detalhes e gerar citações
                  diretamente nos artigos da lista de lidos.
                </li>
                <li>
                  <strong>Ajustes Visuais e de Console:</strong> Inversão de posição dos autores/citações e correção de
                  erros/avisos do console relacionados ao React 19.
                </li>
              </ul>
            </div>

            <div>
              <h3
                style={{
                  margin: '0 0 0.75rem 0',
                  color: 'var(--color-primary)',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '0.25rem',
                }}
              >
                Versão 1.1.9
              </h3>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  color: 'var(--text-main)',
                }}
              >
                <li>
                  <strong>Correção no Reconhecimento de Chaves de API:</strong> Resolvida a inconsistência de nomes nas
                  chaves do Scopus e Web of Science entre as configurações e o motor de busca.
                </li>
                <li>
                  <strong>Retrocompatibilidade de Credenciais:</strong> Adicionado suporte a fallbacks inteligentes para
                  carregar e descriptografar de forma nativa chaves já armazenadas em qualquer convenção de
                  nomenclatura.
                </li>
                <li>
                  <strong>Garantia de Integridade:</strong> Inclusão de novos testes de regressão no banco de dados e
                  orquestrador de chamadas de busca das APIs.
                </li>
              </ul>
            </div>

            <div>
              <h3
                style={{
                  margin: '0 0 0.75rem 0',
                  color: 'var(--color-primary)',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '0.25rem',
                }}
              >
                Versão 1.1.8
              </h3>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  color: 'var(--text-main)',
                }}
              >
                <li>
                  <strong>Artigos Lidos nas Categorias:</strong> Correção na tabela de categorias para exibir também os
                  artigos marcados como lidos, e não apenas os ativos.
                </li>
              </ul>
            </div>

            <div>
              <h3
                style={{
                  margin: '0 0 0.75rem 0',
                  color: 'var(--color-primary)',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '0.25rem',
                }}
              >
                Versão 1.1.7
              </h3>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  color: 'var(--text-main)',
                }}
              >
                <li>
                  <strong>Melhoria na Ancoragem de Destaques:</strong> Nova normalização de caracteres do PDF (como
                  ligaduras, aspas e travessões) que melhora a vinculação automática com o texto.
                </li>
                <li>
                  <strong>Quebras de Linha nas Anotações:</strong> Suporte completo para renderização de quebras de
                  linha (\n) nos comentários, anotações e no popup de hover no leitor.
                </li>
                <li>
                  <strong>Sincronização do Diário:</strong> Resolução de inconsistências de persistência de dados e
                  condições de corrida no diário do projeto.
                </li>
                <li>
                  <strong>Gerenciamento de Opções:</strong> Substituição do prompt nativo por campos de input dinâmicos
                  na criação de opções para categorias de enum.
                </li>
              </ul>
            </div>

            <div>
              <h3
                style={{
                  margin: '0 0 0.75rem 0',
                  color: 'var(--color-primary)',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '0.25rem',
                }}
              >
                Versão 1.1.6
              </h3>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  color: 'var(--text-main)',
                }}
              >
                <li>
                  <strong>Categorias de Seleção Múltipla:</strong> Adicionado suporte a categorias do tipo "seleção
                  múltipla" (multi-select), permitindo selecionar várias opções simultaneamente para classificar cada
                  artigo.
                </li>
              </ul>
            </div>

            <div
              style={{
                padding: '1rem',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                gap: '1rem',
                alignItems: 'flex-start',
              }}
            >
              <AlertCircle size={20} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600 }}>Aviso Importante</p>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Certifique-se de configurar suas chaves de API nas configurações se deseja continuar usando os resumos
                  de IA e busca avançada.
                </p>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={onClose} className="btn-primary">
              Entendido, vamos lá!
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
