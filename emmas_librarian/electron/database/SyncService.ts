import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import { DatabaseManager } from './DatabaseManager';
import { dialog, app } from 'electron';
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
        const insertProj = db.prepare('INSERT INTO projects (name, created_at) VALUES (?, ?)');
        const projResult = insertProj.run(
          data.project.name + ' (Importado)',
          new Date().toISOString()
        );
        const pid = projResult.lastInsertRowid;

        const basePdfsDir = path.join(app.getPath('userData'), 'storage', 'pdfs');
        if (!fs.existsSync(basePdfsDir)) fs.mkdirSync(basePdfsDir, { recursive: true });

        const baseDocsDir = path.join(app.getPath('userData'), 'storage', 'project_documents');
        if (!fs.existsSync(baseDocsDir)) fs.mkdirSync(baseDocsDir, { recursive: true });

        // Article Map (oldId -> newId)
        const articleMap = new Map<number, number>();

        // Insert Articles
        for (const art of data.articles) {
          let newPdfPath = null;
          if (art.local_file_path) {
            const fileName = path.basename(art.local_file_path);
            const pdfEntry = zip.getEntry(`pdfs/${fileName}`);
            if (pdfEntry) {
              const destPath = path.join(basePdfsDir, `${uuidv4()}_${fileName}`);
              fs.writeFileSync(destPath, pdfEntry.getData());
              newPdfPath = destPath;
            }
          }

          const insertArt = db.prepare(`
            INSERT INTO articles (
              project_id, doi, title, authors, year, source_query, source_databases, 
              csl_json, local_file_path, status, archive_note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          
          const artRes = insertArt.run(
            pid, art.doi, art.title, art.authors, art.year, art.source_query, art.source_databases,
            art.csl_json, newPdfPath, art.status, art.archive_note
          );
          articleMap.set(art.id, artRes.lastInsertRowid);
        }

        // Insert Search History
        for (const sh of data.searchHistory) {
          db.prepare(`
            INSERT INTO search_history (
              project_id, unified_query, translated_queries, total_results, results_breakdown
            ) VALUES (?, ?, ?, ?, ?)
          `).run(pid, sh.unified_query, sh.translated_queries, sh.total_results, sh.results_breakdown);
        }

        // Insert Project Docs
        for (const doc of data.projectDocs) {
          let newDocPath = null;
          if (doc.local_file_path) {
            const fileName = path.basename(doc.local_file_path);
            const docEntry = zip.getEntry(`docs/${fileName}`);
            if (docEntry) {
              const destPath = path.join(baseDocsDir, `${uuidv4()}_${fileName}`);
              fs.writeFileSync(destPath, docEntry.getData());
              newDocPath = destPath;
            }
          }

          db.prepare(`
            INSERT INTO project_documents (project_id, title, url, local_file_path)
            VALUES (?, ?, ?, ?)
          `).run(pid, doc.title, doc.url, newDocPath);
        }

        // Insert Project Categories and mapping
        const categoryMap = new Map<number, number>();
        for (const cat of data.projCategories) {
          const res = db.prepare(`
            INSERT INTO project_categories (project_id, name, type, options)
            VALUES (?, ?, ?, ?)
          `).run(pid, cat.name, cat.type, cat.options);
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
              project_id, created_at, status, model_used, questions, articles_ids
            ) VALUES (?, ?, ?, ?, ?, ?)
          `).run(pid, mi.created_at, mi.status, mi.model_used, mi.questions, mi.articles_ids);
          const miId = res.lastInsertRowid;

          // Replace article ids in questions/articles
          // Wait, actually massive investigations just have json. It would be complex to remap article IDs inside articles_ids_json.
          // Let's just remap them if possible.
          try {
            const oldIds: number[] = JSON.parse(mi.articles_ids);
            const newIds = oldIds.map(id => articleMap.get(id)).filter(Boolean);
            db.prepare('UPDATE massive_investigations SET articles_ids = ? WHERE id = ?').run(JSON.stringify(newIds), miId);
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
