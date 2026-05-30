import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import { DatabaseManager } from './DatabaseManager';
import { dialog } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { Project, Article } from '../types';

export class SyncService {
  constructor(private dbManager: DatabaseManager) {}

  public async exportProject(projectId: number): Promise<string | null> {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Exportar Projeto',
      defaultPath: `projeto_${projectId}.emmapcarc`,
      filters: [{ name: 'Emma\'s Librarian Project', extensions: ['emmapcarc'] }]
    });

    if (canceled || !filePath) return null;

    try {
      const db = (this.dbManager as any).db; // Access inner better-sqlite3 db
      
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
      if (!project) throw new Error('Projeto não encontrado');

      const articles = db.prepare('SELECT * FROM articles WHERE project_id = ?').all(projectId);
      const searchHistory = db.prepare('SELECT * FROM search_history WHERE project_id = ?').all(projectId);
      const projectDocs = db.prepare('SELECT * FROM project_documents WHERE project_id = ?').all(projectId);
      const massiveInvs = db.prepare('SELECT * FROM massive_investigations WHERE project_id = ?').all(projectId);
      const projCategories = db.prepare('SELECT * FROM project_categories WHERE project_id = ?').all(projectId);
      
      const articleCategories = db.prepare(`
        SELECT ac.* FROM article_categories ac
        JOIN project_categories pc ON ac.category_id = pc.id
        WHERE pc.project_id = ?
      `).all(projectId);

      const exportData = {
        project,
        articles,
        searchHistory,
        projectDocs,
        massiveInvs,
        projCategories,
        articleCategories
      };

      const zip = new AdmZip();
      
      // Add JSON payload
      zip.addFile('project.json', Buffer.from(JSON.stringify(exportData, null, 2), 'utf-8'));

      // Add PDFs
      for (const article of articles) {
        if (article.local_file_path && fs.existsSync(article.local_file_path)) {
          zip.addLocalFile(article.local_file_path, 'pdfs');
        }
      }

      for (const doc of projectDocs) {
        if (doc.file_path && fs.existsSync(doc.file_path)) {
          zip.addLocalFile(doc.file_path, 'docs');
        }
      }

      zip.writeZip(filePath);
      return filePath;
    } catch (err) {
      console.error('Erro ao exportar:', err);
      throw err;
    }
  }

  public async importProject(providedPath?: string): Promise<number | null> {
    let importPath = providedPath;

    if (!importPath) {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Importar Projeto',
        filters: [{ name: 'Emma\'s Librarian Project', extensions: ['emmapcarc'] }],
        properties: ['openFile']
      });

      if (canceled || filePaths.length === 0) return null;
      importPath = filePaths[0];
    }

    try {
      const zip = new AdmZip(importPath);
      const jsonEntry = zip.getEntry('project.json');
      if (!jsonEntry) throw new Error('Arquivo de projeto inválido (.emmapcarc não contém project.json)');

      const data = JSON.parse(jsonEntry.getData().toString('utf8'));
      
      const db = (this.dbManager as any).db;
      
      const newProjectId = db.transaction(() => {
        // Insert Project
        const insertProj = db.prepare('INSERT INTO projects (name, created_at, updated_at) VALUES (?, ?, ?)');
        const projResult = insertProj.run(
          data.project.name + ' (Importado)',
          new Date().toISOString(),
          new Date().toISOString()
        );
        const pid = projResult.lastInsertRowid;

        const baseStorageDir = (this.dbManager as any).storageDir;

        // Article Map (oldId -> newId)
        const articleMap = new Map<number, number>();

        // Insert Articles
        for (const art of data.articles) {
          let newPdfPath = null;
          if (art.local_file_path) {
            const fileName = path.basename(art.local_file_path);
            const pdfEntry = zip.getEntry(`pdfs/${fileName}`);
            if (pdfEntry) {
              const destPath = path.join(baseStorageDir, `${uuidv4()}_${fileName}`);
              fs.writeFileSync(destPath, pdfEntry.getData());
              newPdfPath = destPath;
            }
          }

          const insertArt = db.prepare(`
            INSERT INTO articles (
              project_id, title, authors, abstract, year, doi, journal, 
              source_databases, pmid, pubmed_central_id, url, status, 
              created_at, updated_at, local_file_path, extraction_status,
              notes, ai_summary, citation_count, affiliations, is_open_access, keywords
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          const artRes = insertArt.run(
            pid, art.title, art.authors, art.abstract, art.year, art.doi, art.journal,
            art.source_databases, art.pmid, art.pubmed_central_id, art.url, art.status,
            new Date().toISOString(), new Date().toISOString(), newPdfPath, art.extraction_status,
            art.notes, art.ai_summary, art.citation_count, art.affiliations, art.is_open_access, art.keywords
          );
          articleMap.set(art.id, artRes.lastInsertRowid);
        }

        // Insert Search History
        for (const sh of data.searchHistory) {
          db.prepare(`
            INSERT INTO search_history (
              project_id, query, timestamp, results_count, filters, source_databases
            ) VALUES (?, ?, ?, ?, ?, ?)
          `).run(pid, sh.query, sh.timestamp, sh.results_count, sh.filters, sh.source_databases);
        }

        // Insert Project Docs
        for (const doc of data.projectDocs) {
          let newDocPath = null;
          if (doc.file_path) {
            const fileName = path.basename(doc.file_path);
            const docEntry = zip.getEntry(`docs/${fileName}`);
            if (docEntry) {
              const destPath = path.join(baseStorageDir, `${uuidv4()}_${fileName}`);
              fs.writeFileSync(destPath, docEntry.getData());
              newDocPath = destPath;
            }
          }

          db.prepare(`
            INSERT INTO project_documents (project_id, file_path, file_name, created_at, content)
            VALUES (?, ?, ?, ?, ?)
          `).run(pid, newDocPath, doc.file_name, doc.created_at, doc.content);
        }

        // Insert Project Categories and mapping
        const categoryMap = new Map<number, number>();
        for (const cat of data.projCategories) {
          const res = db.prepare(`
            INSERT INTO project_categories (project_id, name, type)
            VALUES (?, ?, ?)
          `).run(pid, cat.name, cat.type);
          categoryMap.set(cat.id, res.lastInsertRowid);
        }

        // Insert Article Categories
        for (const ac of data.articleCategories) {
          const newArtId = articleMap.get(ac.article_id);
          const newCatId = categoryMap.get(ac.category_id);
          if (newArtId && newCatId) {
            db.prepare(`
              INSERT INTO article_categories (article_id, category_id, value)
              VALUES (?, ?, ?)
            `).run(newArtId, newCatId, ac.value);
          }
        }

        // Massive Investigations
        for (const mi of data.massiveInvs) {
          const res = db.prepare(`
            INSERT INTO massive_investigations (
              project_id, created_at, status, model_used, questions_json, articles_ids_json
            ) VALUES (?, ?, ?, ?, ?, ?)
          `).run(pid, mi.created_at, mi.status, mi.model_used, mi.questions_json, mi.articles_ids_json);
          const miId = res.lastInsertRowid;

          // Replace article ids in questions/articles
          // Wait, actually massive investigations just have json. It would be complex to remap article IDs inside articles_ids_json.
          // Let's just remap them if possible.
          try {
            const oldIds: number[] = JSON.parse(mi.articles_ids_json);
            const newIds = oldIds.map(id => articleMap.get(id)).filter(Boolean);
            db.prepare('UPDATE massive_investigations SET articles_ids_json = ? WHERE id = ?').run(JSON.stringify(newIds), miId);
          } catch (e) {
            // ignore
          }
        }

        return pid;
      })();
      
      return newProjectId;
    } catch (err) {
      console.error('Erro ao importar:', err);
      throw err;
    }
  }
}
