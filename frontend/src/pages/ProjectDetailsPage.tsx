import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectService } from '../services/api';
import { Project, Article } from '../types';
import { ArrowLeft, ExternalLink, FileText, Calendar, Database, Search } from 'lucide-react';

export const ProjectDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const [projData, artData] = await Promise.all([
          projectService.getProject(parseInt(id)),
          projectService.getArticles(parseInt(id))
        ]);
        setProject(projData);
        setArticles(artData);
      } catch (err) {
        console.error('Erro ao carregar dados do projeto', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const filteredArticles = articles.filter(a => 
    a.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.autores?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Carregando...</div>;
  if (!project) return <div style={{ padding: '2rem', textAlign: 'center' }}>Projeto não encontrado.</div>;

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', textDecoration: 'none', color: '#64748b' }}>
        <ArrowLeft size={18} /> Voltar para Projetos
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>{project.name}</h1>
          <p style={{ color: '#64748b', margin: '0.5rem 0 0' }}>
            Criado em: {new Date(project.data_criacao).toLocaleDateString()} | {articles.length} artigos encontrados
          </p>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
        <div style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
          <Search size={18} />
        </div>
        <input 
          type="text" 
          placeholder="Filtrar por título ou autor..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', padding: '0.8rem 0.8rem 0.8rem 2.5rem', fontSize: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px' }}
        />
      </div>

      <div style={{ overflowX: 'auto', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '1rem' }}>Título</th>
              <th style={{ padding: '1rem' }}>Autores</th>
              <th style={{ padding: '1rem' }}>Ano</th>
              <th style={{ padding: '1rem' }}>Bases</th>
              <th style={{ padding: '1rem' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredArticles.map(article => (
              <tr key={article.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '1rem', maxWidth: '400px' }}>
                  <div style={{ fontWeight: '600', color: '#1e293b' }}>{article.titulo}</div>
                  {article.doi && (
                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.2rem' }}>
                      DOI: {article.doi}
                    </div>
                  )}
                </td>
                <td style={{ padding: '1rem', color: '#475569', fontSize: '0.9rem' }}>{article.autores}</td>
                <td style={{ padding: '1rem', color: '#475569' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Calendar size={14} /> {article.ano || 'N/A'}
                  </div>
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    {JSON.parse(article.base_origem as any).map((base: string) => (
                      <span key={base} style={{ padding: '0.2rem 0.5rem', background: '#f1f5f9', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        {base}
                      </span>
                    ))}
                  </div>
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button style={{ padding: '0.5rem', background: '#f0f9ff', color: '#0ea5e9', border: '1px solid #bae6fd', borderRadius: '4px', cursor: 'pointer' }} title="Ler Artigo">
                      <FileText size={18} />
                    </button>
                    {article.doi && (
                      <a href={`https://doi.org/${article.doi}`} target="_blank" rel="noreferrer" style={{ padding: '0.5rem', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '4px' }} title="Abrir no Navegador">
                        <ExternalLink size={18} />
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredArticles.length === 0 && (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            Nenhum artigo encontrado.
          </div>
        )}
      </div>
    </div>
  );
};
