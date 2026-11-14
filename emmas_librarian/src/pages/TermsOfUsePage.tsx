import React from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { TermsToc } from './Terms/TermsToc';
import { BASE_POLICIES, TERMS_VERSION, type BasePolicy } from './Terms/termsContent';
import { LegalReviewNotice } from '../components/common/LegalReviewNotice';
import './Terms/terms.css';

const PolicyRow: React.FC<{ policy: BasePolicy }> = ({ policy }) => (
  <div className="terms-policy">
    <div className="terms-policy__who">
      <span className="terms-policy__name">{policy.name}</span>
      <span className={`terms-badge is-${policy.tone}`}>
        {policy.tone === 'free' ? (
          <Check size={12} aria-hidden="true" />
        ) : (
          <AlertTriangle size={12} aria-hidden="true" />
        )}
        {policy.badge}
      </span>
    </div>
    <p>
      {policy.text}{' '}
      <a href={policy.href} target="_blank" rel="noopener noreferrer">
        {policy.linkLabel}
      </a>
    </p>
  </div>
);

/**
 * The terms of use and AI (board 174): a reading column with "Nesta página" beside it. The first paragraphs say what
 * stays on the computer and what leaves with the author's own keys; then what each base allows and the disclaimer.
 *
 * @example <Route path="/terms" element={<TermsOfUsePage />} />
 */
export const TermsOfUsePage: React.FC = () => (
  <div className="fade-in terms-page">
    <TermsToc />
    <article className="terms-article">
      <header>
        <span className="terms-article__version">Atualizado na versão {TERMS_VERSION}</span>
        <h1>Termos de uso e IA</h1>
      </header>
      <p id="local-first" className="terms-lead">
        O <strong>Emma&apos;s Librarian</strong> é feito para funcionar no seu computador. Projetos, buscas e anotações
        não saem daqui.
      </p>
      <p id="ia-e-chaves" className="terms-lead">
        Quando você usa IA ou bases pagas, as informações vão para os serviços que <strong>você</strong> configurou, com
        as suas chaves.
      </p>
      <LegalReviewNotice />
      <h2 id="dados-por-base">O que cada base permite</h2>
      <div>
        {BASE_POLICIES.map((policy) => (
          <PolicyRow key={policy.name} policy={policy} />
        ))}
      </div>
      <div id="responsabilidade" className="terms-disclaimer" role="note">
        <AlertTriangle size={16} aria-hidden="true" />
        <p>
          <strong>Isenção de responsabilidade.</strong> O app só automatiza o que você pede, com as suas chaves. Cabe a
          você garantir que o que vai para a IA não viola as licenças da sua conta ou instituição.
        </p>
      </div>
    </article>
  </div>
);
