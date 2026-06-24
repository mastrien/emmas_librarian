import React from 'react';
import { Shield, ExternalLink, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export const TermsOfUsePage: React.FC = () => {
  return (
    <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '3rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
        <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'flex' }}>
          <ArrowLeft size={24} />
        </Link>
        <div
          style={{
            background: 'var(--color-primary)',
            color: 'white',
            padding: '0.75rem',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
          }}
        >
          <Shield size={28} />
        </div>
        <h1 style={{ margin: 0, fontSize: '2.5rem' }}>Termos de Uso e IA</h1>
      </div>

      <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <section>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--text-heading)' }}>
            Privacidade e Processamento Local
          </h2>
          <p style={{ color: 'var(--text-main)', lineHeight: 1.6 }}>
            O <strong>Emma's Librarian</strong> é uma aplicação projetada sob a filosofia "Local-First". Isso significa
            que seus projetos, histórico de busca e anotações nunca saem do seu computador. No entanto, ao utilizar
            recursos de Integração com Inteligência Artificial ou buscas em bases proprietárias, informações podem ser
            trafegadas para as APIs que você configurar.
          </p>
        </section>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

        <section>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: 'var(--text-heading)' }}>
            Políticas de Extração de Dados (TDM) e IAs por Base
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* OpenAlex */}
            <div
              style={{
                padding: '1.5rem',
                background: 'var(--bg-main)',
                border: '1px solid var(--color-success)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <h3
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: 'var(--color-success)',
                  marginTop: 0,
                }}
              >
                OpenAlex
              </h3>
              <p style={{ margin: '0.5rem 0', lineHeight: 1.5 }}>
                <strong>Totalmente Livre (CC0).</strong> Todos os dados podem ser usados para qualquer propósito,
                incluindo alimentar e treinar Modelos de Linguagem (LLMs). O uso integrado da IA com metadados do
                OpenAlex é 100% legal e encorajado pela plataforma.
              </p>
              <a
                href="https://openalex.org/about"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  color: 'var(--color-primary)',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  marginTop: '0.5rem',
                }}
              >
                <ExternalLink size={16} /> Ver Política do OpenAlex
              </a>
            </div>

            {/* Crossref */}
            <div
              style={{
                padding: '1.5rem',
                background: 'var(--bg-main)',
                border: '1px solid var(--color-success)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <h3
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: 'var(--color-success)',
                  marginTop: 0,
                }}
              >
                Crossref
              </h3>
              <p style={{ margin: '0.5rem 0', lineHeight: 1.5 }}>
                <strong>Metadados Livres.</strong> Os metadados da Crossref são abertos e livres de restrições de
                direitos autorais para processamento. Atenção: isso se aplica aos <em>metadados</em>, mas os PDFs cujo
                link a Crossref fornece obedecem aos direitos autorais de suas respectivas editoras.
              </p>
              <a
                href="https://www.crossref.org/documentation/retrieve-metadata/rest-api/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  color: 'var(--color-primary)',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  marginTop: '0.5rem',
                }}
              >
                <ExternalLink size={16} /> Ver Política da Crossref
              </a>
            </div>

            {/* Scopus */}
            <div
              style={{
                padding: '1.5rem',
                background: 'var(--bg-main)',
                border: '1px solid var(--color-warning)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <h3
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: 'var(--color-warning)',
                  marginTop: 0,
                }}
              >
                Scopus (Elsevier)
              </h3>
              <p style={{ margin: '0.5rem 0', lineHeight: 1.5 }}>
                <strong>Altamente Restritivo.</strong> A extração (TDM) via API é estrita para fins acadêmicos e não
                comerciais. Enviar resumos obtidos via Scopus para IAs externas (ex: OpenAI) pode violar os termos de
                serviço caso sua licença institucional não autorize expressamente a integração com IAs de terceiros.
              </p>
              <a
                href="https://dev.elsevier.com/tecdoc_text_mining.html"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  color: 'var(--color-primary)',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  marginTop: '0.5rem',
                }}
              >
                <ExternalLink size={16} /> Ver Política da Elsevier/Scopus
              </a>
            </div>

            {/* Web of Science */}
            <div
              style={{
                padding: '1.5rem',
                background: 'var(--bg-main)',
                border: '1px solid var(--color-warning)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <h3
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: 'var(--color-warning)',
                  marginTop: 0,
                }}
              >
                Web of Science (Clarivate)
              </h3>
              <p style={{ margin: '0.5rem 0', lineHeight: 1.5 }}>
                <strong>Altamente Restritivo.</strong> O uso da API proíbe que você utilize os dados extraídos em
                conjunto com tecnologias ou algoritmos de Inteligência Artificial não autorizados pela Clarivate.
              </p>
              <a
                href="https://clarivate.com/terms-of-business/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  color: 'var(--color-primary)',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  marginTop: '0.5rem',
                }}
              >
                <ExternalLink size={16} /> Ver Termos da Clarivate
              </a>
            </div>
          </div>
        </section>

        <section
          style={{
            marginTop: '1rem',
            padding: '1rem',
            background: 'rgba(234, 179, 8, 0.1)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.95rem' }}>
            <strong>Aviso de Isenção de Responsabilidade:</strong> O Emma's Librarian é uma ferramenta de automação
            passiva (Traga Sua Própria Chave). É sua responsabilidade garantir que os artigos que você submete aos
            serviços de Inteligência Artificial não violam os acordos de licenciamento atrelados à sua conta ou
            instituição.
          </p>
        </section>
      </div>
    </div>
  );
};
