import React from 'react';
import { Brain, ShieldAlert, Key, RotateCcw, Save, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AIModelConfig, AISkill, AIProvider } from '../../../types';

interface AiSettingsProps {
  openaiKey: string;
  setOpenaiKey: (v: string) => void;
  geminiKey: string;
  setGeminiKey: (v: string) => void;
  anthropicKey: string;
  setAnthropicKey: (v: string) => void;
  ollamaUrl: string;
  setOllamaUrl: (v: string) => void;
  ollamaCloudKey: string;
  setOllamaCloudKey: (v: string) => void;
  aiConfigs: AIModelConfig[];
  handleUpdateAiConfig: (skill: AISkill, field: 'provider' | 'model_name', value: string) => void;
  getModelSuggestions: (skill: AISkill, provider: AIProvider) => string[];
  ragChunkSize: string;
  setRagChunkSize: (v: string) => void;
  ragChunkOverlap: string;
  setRagChunkOverlap: (v: string) => void;
  ragTopK: string;
  setRagTopK: (v: string) => void;
  handleRestoreAiDefaults: () => void;
  handleSaveKeys: () => void;
  saving: boolean;
  saved: boolean;
}

export const AiSettings: React.FC<AiSettingsProps> = ({
  openaiKey,
  setOpenaiKey,
  geminiKey,
  setGeminiKey,
  anthropicKey,
  setAnthropicKey,
  ollamaUrl,
  setOllamaUrl,
  ollamaCloudKey,
  setOllamaCloudKey,
  aiConfigs,
  handleUpdateAiConfig,
  getModelSuggestions,
  ragChunkSize,
  setRagChunkSize,
  ragChunkOverlap,
  setRagChunkOverlap,
  ragTopK,
  setRagTopK,
  handleRestoreAiDefaults,
  handleSaveKeys,
  saving,
  saved,
}) => {
  return (
    <div className="card" style={{ padding: '2rem' }}>
      <h2
        style={{
          fontSize: '1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <Brain size={24} color="var(--color-primary)" /> Integrações de Inteligência Artificial
      </h2>
      <div
        style={{
          padding: '1rem',
          background: 'rgba(234, 179, 8, 0.1)',
          border: '1px solid rgba(234, 179, 8, 0.3)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
        }}
      >
        <ShieldAlert size={20} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: 1.5 }}>
          Ao usar funcionalidades de Inteligência Artificial, dados podem ser enviados para provedores externos.
          <br />
          <Link to="/terms" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
            Leia os Termos de Uso e IA completos aqui.
          </Link>
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-heading)' }}>
            OpenAI API Key
          </label>
          <div style={{ position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            >
              <Key size={18} />
            </div>
            <input
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-..."
              style={{
                width: '100%',
                padding: '0.8rem 1rem 0.8rem 2.8rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-main)',
                color: 'var(--text-main)',
                outline: 'none',
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-heading)' }}>
            Google Gemini API Key
          </label>
          <div style={{ position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            >
              <Key size={18} />
            </div>
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIza..."
              style={{
                width: '100%',
                padding: '0.8rem 1rem 0.8rem 2.8rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-main)',
                color: 'var(--text-main)',
                outline: 'none',
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-heading)' }}>
            Anthropic API Key
          </label>
          <div style={{ position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            >
              <Key size={18} />
            </div>
            <input
              type="password"
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              placeholder="sk-ant-..."
              style={{
                width: '100%',
                padding: '0.8rem 1rem 0.8rem 2.8rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-main)',
                color: 'var(--text-main)',
                outline: 'none',
              }}
              title="Ex: claude-3-5-sonnet-20240620"
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-heading)' }}>
            Ollama URL (Local){' '}
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 'normal' }}>
              (Ex: http://127.0.0.1:11434/v1)
            </span>
          </label>
          <div style={{ position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            >
              <Key size={18} />
            </div>
            <input
              type="text"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              placeholder="http://127.0.0.1:11434/v1"
              style={{
                width: '100%',
                padding: '0.8rem 1rem 0.8rem 2.8rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-main)',
                color: 'var(--text-main)',
                outline: 'none',
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-heading)' }}>
            Ollama Cloud API Key (Nuvem)
          </label>
          <div style={{ position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            >
              <Key size={18} />
            </div>
            <input
              type="password"
              value={ollamaCloudKey}
              onChange={(e) => setOllamaCloudKey(e.target.value)}
              placeholder="Insira sua chave de API Ollama Cloud..."
              style={{
                width: '100%',
                padding: '0.8rem 1rem 0.8rem 2.8rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-main)',
                color: 'var(--text-main)',
                outline: 'none',
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleSaveKeys} className="btn-primary" disabled={saving} style={{ minWidth: '150px' }}>
            {saved ? <CheckCircle size={20} /> : <Save size={20} />}
            {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Chaves'}
          </button>
        </div>

        {/* Advanced AI Settings */}
        <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--text-heading)' }}>
            Configurações Avançadas por Funcionalidade
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Personalize qual provedor e modelo devem ser utilizados para cada tipo de funcionalidade.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {aiConfigs.map((conf) => (
              <div
                key={conf.skill}
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  background: 'var(--bg-main)',
                }}
              >
                <h4
                  style={{
                    margin: '0 0 1rem 0',
                    color: 'var(--text-heading)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  {conf.skill === 'metadata' && '📄 Extração de Metadados'}
                  {conf.skill === 'summary' && '📝 Geração de Resumos'}
                  {conf.skill === 'extraction' && '🔍 Investigação Massiva (RAG)'}
                  {conf.skill === 'embeddings' && '🧮 Embeddings (Vetorização)'}
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: '0.5rem',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                      }}
                    >
                      Provedor
                    </label>
                    <select
                      value={conf.provider}
                      onChange={(e) => handleUpdateAiConfig(conf.skill, 'provider', e.target.value as AIProvider)}
                      className="input-field"
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.8rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-main)',
                        outline: 'none',
                      }}
                    >
                      <option value="local">Local Embutido (ONNX)</option>
                      <option value="gemini">Google Gemini</option>
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="ollama">Ollama (Local)</option>
                      <option value="ollama_cloud">Ollama Cloud (Nuvem)</option>
                    </select>
                  </div>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: '0.5rem',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                      }}
                    >
                      Modelo
                    </label>
                    <input
                      type="text"
                      value={conf.model_name}
                      onChange={(e) => handleUpdateAiConfig(conf.skill, 'model_name', e.target.value)}
                      className="input-field"
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.8rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-main)',
                        outline: 'none',
                      }}
                      placeholder="Ex: gemini-2.5-flash"
                    />
                    {getModelSuggestions(conf.skill, conf.provider).length > 0 && (
                      <div
                        style={{
                          marginTop: '0.4rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sugestões:</span>
                        {getModelSuggestions(conf.skill, conf.provider).map((sug) => (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => handleUpdateAiConfig(conf.skill, 'model_name', sug)}
                            style={{
                              fontSize: '0.72rem',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '12px',
                              border:
                                conf.model_name === sug
                                  ? '1px solid var(--primary-color)'
                                  : '1px solid var(--border-color)',
                              background:
                                conf.model_name === sug ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-card)',
                              color: conf.model_name === sug ? 'var(--primary-color)' : 'var(--text-muted)',
                              cursor: 'pointer',
                              fontWeight: conf.model_name === sug ? 600 : 400,
                            }}
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {conf.skill === 'embeddings' && (
                  <div
                    style={{
                      marginTop: '0.6rem',
                      padding: '0.66rem 0.9rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(234, 179, 8, 0.1)',
                      border: '1px solid rgba(234, 179, 8, 0.35)',
                      color: 'var(--text-main)',
                      fontSize: '0.82rem',
                      lineHeight: '1.4',
                    }}
                  >
                    ⚠️ <strong>Aviso de Recomendação:</strong> Atualmente, a funcionalidade de vetorização (Embeddings) funciona melhor e com maior estabilidade utilizando o <strong>Ollama (Local)</strong> ouvindo na porta 11434 com modelos como <code>nomic-embed-text</code>.
                  </div>
                )}
              </div>
            ))}

            <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-heading)' }}>
                Parâmetros Avançados de RAG (Investigação Massiva)
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                    }}
                  >
                    Tamanho do Chunk (caracteres)
                  </label>
                  <input
                    type="number"
                    value={ragChunkSize}
                    onChange={(e) => setRagChunkSize(e.target.value)}
                    className="input-field"
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-main)',
                      outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                    }}
                  >
                    Overlap (caracteres)
                  </label>
                  <input
                    type="number"
                    value={ragChunkOverlap}
                    onChange={(e) => setRagChunkOverlap(e.target.value)}
                    className="input-field"
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-main)',
                      outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                    }}
                  >
                    Chunks Recuperados (Top K)
                  </label>
                  <input
                    type="number"
                    value={ragTopK}
                    onChange={(e) => setRagTopK(e.target.value)}
                    className="input-field"
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-main)',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            </div>

            <div
              style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <button
                onClick={handleRestoreAiDefaults}
                className="btn-secondary"
                style={{ color: 'var(--color-danger)', fontSize: '0.9rem', padding: '0.5rem 1rem' }}
              >
                <RotateCcw size={14} style={{ marginRight: '0.4rem' }} /> Restaurar Padrões
              </button>
              <button
                onClick={handleSaveKeys}
                className="btn-primary"
                disabled={saving}
                style={{ minWidth: '150px' }}
              >
                {saved ? (
                  <CheckCircle size={18} style={{ marginRight: '0.4rem' }} />
                ) : (
                  <Save size={18} style={{ marginRight: '0.4rem' }} />
                )}
                {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Configuração'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
