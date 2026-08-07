import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DatabaseAdapter } from './DatabaseAdapter';
import { dialog, app } from 'electron';
import { v4 as uuidv4 } from 'uuid';

export class ProjectSyncService {
  constructor(private dbAdapter: DatabaseAdapter) {}



  public async exportProject(projectId: number): Promise<string | null> {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Exportar Projeto',
      defaultPath: `projeto_${projectId}.emmapcarc`,
      filters: [{ name: "Emma's Librarian Project", extensions: ['emmapcarc'] }],
    });

    if (canceled || !filePath) return null;

    try {
      const db = (this.dbAdapter as any).getDB ? (this.dbAdapter as any).getDB() : (this.dbAdapter as any).db;

      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
      if (!project) throw new Error('Projeto não encontrado');

      const articles = db.prepare('SELECT * FROM articles WHERE project_id = ?').all(projectId);
      const searchHistory = db.prepare('SELECT * FROM search_history WHERE project_id = ?').all(projectId);
      const projectDocs = db.prepare('SELECT * FROM project_documents WHERE project_id = ?').all(projectId);
      const massiveInvs = db.prepare('SELECT * FROM massive_investigations WHERE project_id = ?').all(projectId);
      const projCategories = db.prepare('SELECT * FROM project_categories WHERE project_id = ?').all(projectId);

      const articleCategories = db
        .prepare(
          `
        SELECT ac.* FROM article_categories ac
        JOIN project_categories pc ON ac.category_id = pc.id
        WHERE pc.project_id = ?
      `,
        )
        .all(projectId);

      const annotations = db
        .prepare(
          `
        SELECT a.* FROM annotations a
        JOIN articles art ON a.article_id = art.id
        WHERE art.project_id = ?
      `,
        )
        .all(projectId);

      const highlights = db
        .prepare(
          `
        SELECT h.* FROM highlights h
        JOIN articles art ON h.article_id = art.id
        WHERE art.project_id = ?
      `,
        )
        .all(projectId);

      const pendingHighlights = db
        .prepare(
          `
        SELECT ph.* FROM pending_highlights ph
        JOIN articles art ON ph.article_id = art.id
        WHERE art.project_id = ?
      `,
        )
        .all(projectId);

      const diaryEntries = db.prepare('SELECT * FROM project_diary WHERE project_id = ?').all(projectId);

      // Export diary version history so rollback data is preserved across environments
      const diaryHistory = db.prepare('SELECT * FROM project_diary_history WHERE project_id = ?').all(projectId);

      // Export relational category options (enum/multiselect choices per category)
      const categoryOptions = db
        .prepare(
          `SELECT pco.* FROM project_category_options pco
           JOIN project_categories pc ON pco.category_id = pc.id
           WHERE pc.project_id = ?`,
        )
        .all(projectId);

      // Export per-article enum/multiselect selections (references category option IDs)
      const categorySelections = db
        .prepare(
          `SELECT acs.* FROM article_category_selections acs
           JOIN project_categories pc ON acs.category_id = pc.id
           WHERE pc.project_id = ?`,
        )
        .all(projectId);

      // Export question sets scoped to this project (project_id = projectId) plus global ones (project_id IS NULL)
      const questionSets = db
        .prepare('SELECT * FROM question_sets WHERE project_id = ? OR project_id IS NULL')
        .all(projectId);

      // Export granular investigation results for all investigations in this project
      const investigationResults = db
        .prepare(
          `SELECT ir.* FROM investigation_results ir
           JOIN massive_investigations mi ON ir.investigation_id = mi.id
           WHERE mi.project_id = ?`,
        )
        .all(projectId);

      const exportData = {
        project,
        articles,
        searchHistory,
        projectDocs,
        massiveInvs,
        projCategories,
        categoryOptions,
        articleCategories,
        categorySelections,
        annotations,
        highlights,
        pendingHighlights,
        diaryEntries,
        diaryHistory,
        questionSets,
        investigationResults,
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
        filters: [{ name: "Emma's Librarian Project", extensions: ['emmapcarc'] }],
        properties: ['openFile'],
      });

      if (canceled || filePaths.length === 0) return null;
      importPath = filePaths[0];
    }

    try {
      const zip = new AdmZip(importPath);
      const jsonEntry = zip.getEntry('project.json');
      if (!jsonEntry) throw new Error('Arquivo de projeto inválido (.emmapcarc não contém project.json)');

      const data = JSON.parse(jsonEntry.getData().toString('utf8'));

      const db = (this.dbAdapter as any).getDB ? (this.dbAdapter as any).getDB() : (this.dbAdapter as any).db;

      const newProjectId = db.transaction(() => {
        // Insert Project (preserves writing_pad and last_executed_at)
        const insertProj = db.prepare(
          'INSERT INTO projects (name, created_at, last_executed_at, writing_pad) VALUES (?, ?, ?, ?)',
        );
        const projResult = insertProj.run(
          data.project.name + ' (Importado)',
          data.project.created_at || new Date().toISOString(),
          data.project.last_executed_at || null,
          data.project.writing_pad || null,
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
              const fileData = pdfEntry.getData();
              const fileHash = crypto.createHash('sha256').update(fileData).digest('hex');
              
              const existingPdf = db.prepare('SELECT file_path FROM pdf_files WHERE file_hash = ?').get(fileHash) as any;
              
              if (existingPdf && fs.existsSync(existingPdf.file_path)) {
                newPdfPath = existingPdf.file_path;
              } else {
                const destPath = path.join(basePdfsDir, `${uuidv4()}_${fileName}`);
                fs.writeFileSync(destPath, fileData);
                newPdfPath = destPath;
                db.prepare('INSERT OR REPLACE INTO pdf_files (file_path, file_hash, filename, file_size) VALUES (?, ?, ?, ?)').run(destPath, fileHash, fileName, fileData.length);
              }
            }
          }

          const insertArt = db.prepare(`
            INSERT INTO articles (
              project_id, doi, title, authors, year, source_query, source_databases,
              csl_json, local_file_path, status, archive_note,
              abstract, author_keywords, index_keywords, journal, volume, issue, pages,
              affiliations, references_list, document_type, issn, citation_count,
              ai_summary, is_oa, publisher, url, accessed, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          const artRes = insertArt.run(
            pid,
            art.doi,
            art.title,
            art.authors,
            art.year,
            art.source_query,
            art.source_databases,
            art.csl_json,
            newPdfPath,
            art.status,
            art.archive_note,
            art.abstract || null,
            art.author_keywords || null,
            art.index_keywords || null,
            art.journal || null,
            art.volume || null,
            art.issue || null,
            art.pages || null,
            art.affiliations || null,
            art.references_list || null,
            art.document_type || null,
            art.issn || null,
            art.citation_count || null,
            art.ai_summary || null,
            art.is_oa ?? null,
            art.publisher || null,
            art.url || null,
            art.accessed || null,
            art.created_at || new Date().toISOString(),
            art.updated_at || new Date().toISOString()
          );
          articleMap.set(art.id, artRes.lastInsertRowid);
        }

        // Insert Search History
        for (const sh of data.searchHistory) {
          db.prepare(
            `
            INSERT INTO search_history (
              project_id, unified_query, translated_queries, total_results, results_breakdown, sort_by, limit_val, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          ).run(
            pid,
            sh.unified_query,
            sh.translated_queries,
            sh.total_results,
            sh.results_breakdown,
            sh.sort_by || null,
            sh.limit_val ?? null,
            sh.created_at || new Date().toISOString(),
          );
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

          db.prepare(
            `
            INSERT INTO project_documents (project_id, title, url, local_file_path, created_at)
            VALUES (?, ?, ?, ?, ?)
          `,
          ).run(pid, doc.title, doc.url, newDocPath, doc.created_at || new Date().toISOString());
        }

        // Insert Project Categories and mapping
        const categoryMap = new Map<number, number>();
        for (const cat of data.projCategories) {
          const res = db
            .prepare(
              `INSERT INTO project_categories (project_id, name, type, options)
               VALUES (?, ?, ?, ?)`,
            )
            .run(pid, cat.name, cat.type, cat.options);
          categoryMap.set(cat.id, res.lastInsertRowid);
        }

        // Insert Category Options (enum/multiselect choices), remapping category_id
        // optionMap: oldOptionId -> newOptionId, needed to remap article_category_selections
        const optionMap = new Map<number, number>();
        for (const opt of data.categoryOptions || []) {
          const newCatId = categoryMap.get(opt.category_id);
          if (newCatId) {
            const res = db
              .prepare('INSERT INTO project_category_options (category_id, name) VALUES (?, ?)')
              .run(newCatId, opt.name);
            optionMap.set(opt.id, res.lastInsertRowid);
          }
        }

        // Insert Article Categories (text/boolean types — value stored as plain string)
        for (const ac of data.articleCategories) {
          const newArtId = articleMap.get(ac.article_id);
          const newCatId = categoryMap.get(ac.category_id);
          if (newArtId && newCatId) {
            db.prepare(
              `INSERT INTO article_categories (article_id, category_id, value)
               VALUES (?, ?, ?)`,
            ).run(newArtId, newCatId, ac.value);
          }
        }

        // Insert Article Category Selections (enum/multiselect — reference option IDs)
        for (const sel of data.categorySelections || []) {
          const newArtId = articleMap.get(sel.article_id);
          const newCatId = categoryMap.get(sel.category_id);
          const newOptId = optionMap.get(sel.option_id);
          if (newArtId && newCatId && newOptId) {
            try {
              db.prepare(
                `INSERT INTO article_category_selections (article_id, category_id, option_id)
                 VALUES (?, ?, ?)`,
              ).run(newArtId, newCatId, newOptId);
            } catch (e) {
              // ignore duplicate PK on retry
            }
          }
        }

        // Massive Investigations
        const investigationMap = new Map<number, number>();
        for (const mi of data.massiveInvs) {
          const res = db
            .prepare(
              `INSERT INTO massive_investigations (
                project_id, created_at, status, model_used, questions, articles_ids
              ) VALUES (?, ?, ?, ?, ?, ?)`,
            )
            .run(pid, mi.created_at, mi.status, mi.model_used, mi.questions, mi.articles_ids);
          const miId = res.lastInsertRowid;
          investigationMap.set(mi.id, miId);

          // Remap article IDs embedded in the articles_ids JSON array
          try {
            const oldIds: number[] = JSON.parse(mi.articles_ids);
            const newIds = oldIds.map((id) => articleMap.get(id)).filter(Boolean);
            db.prepare('UPDATE massive_investigations SET articles_ids = ? WHERE id = ?').run(
              JSON.stringify(newIds),
              miId,
            );
          } catch (e) {
            // ignore malformed JSON
          }
        }

        // Insert Investigation Results, remapping investigation_id and article_id
        for (const ir of data.investigationResults || []) {
          const newInvId = investigationMap.get(ir.investigation_id);
          const newArtId = articleMap.get(ir.article_id);
          if (newInvId && newArtId) {
            db.prepare(
              `INSERT INTO investigation_results (
                investigation_id, article_id, question, answer, quote, status, error_message, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            ).run(
              newInvId,
              newArtId,
              ir.question,
              ir.answer || null,
              ir.quote || null,
              ir.status || 'success',
              ir.error_message || null,
              ir.created_at,
            );
          }
        }

        // Insert Question Sets scoped to this project
        // Global question sets (project_id IS NULL) are included in the export for completeness
        // but are re-imported as project-scoped to avoid global namespace collision
        for (const qs of data.questionSets || []) {
          db.prepare(
            `INSERT INTO question_sets (project_id, name, description, questions, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          ).run(pid, qs.name, qs.description || null, qs.questions, qs.created_at, qs.updated_at);
        }

        // Insert Annotations
        const annotationMap = new Map<number, number>();
        const annotationsToImport = data.annotations || [];
        for (const ann of annotationsToImport) {
          const newArtId = articleMap.get(ann.article_id);
          if (newArtId) {
            // highlight_id linkage is resolved after highlights are inserted
            const res = db
              .prepare(
                `
              INSERT INTO annotations (article_id, content_markdown, created_at)
              VALUES (?, ?, ?)
            `,
              )
              .run(newArtId, ann.content_markdown, ann.created_at);
            annotationMap.set(ann.id, res.lastInsertRowid);
          }
        }

        // Insert Highlights
        const highlightsToImport = data.highlights || [];
        for (const hl of highlightsToImport) {
          const newArtId = articleMap.get(hl.article_id);
          if (newArtId) {
            const newAnnId = hl.annotation_id ? annotationMap.get(hl.annotation_id) : null;
            db.prepare(
              `
              INSERT INTO highlights (article_id, color, position_data, content_text, annotation_id)
              VALUES (?, ?, ?, ?, ?)
            `,
            ).run(newArtId, hl.color, hl.position_data, hl.content_text, newAnnId);
          }
        }

        // Insert Pending Highlights
        const pendingHighlightsToImport = data.pendingHighlights || [];
        for (const ph of pendingHighlightsToImport) {
          const newArtId = articleMap.get(ph.article_id);
          if (newArtId) {
            db.prepare(
              `
              INSERT INTO pending_highlights (article_id, quote, context_before, context_after, comment, created_at)
              VALUES (?, ?, ?, ?, ?, ?)
            `,
            ).run(newArtId, ph.quote, ph.context_before, ph.context_after, ph.comment, ph.created_at);
          }
        }

        // Insert Diary Entries
        const diaryEntriesToImport = data.diaryEntries || [];
        for (const de of diaryEntriesToImport) {
          db.prepare(
            `
            INSERT OR REPLACE INTO project_diary (project_id, entry_date, content)
            VALUES (?, ?, ?)
          `,
          ).run(pid, de.entry_date, de.content);
        }

        // Insert Diary Version History (preserves rollback capability across environments)
        const diaryHistoryToImport = data.diaryHistory || [];
        for (const dh of diaryHistoryToImport) {
          db.prepare(
            `
            INSERT INTO project_diary_history (project_id, entry_date, content, updated_at)
            VALUES (?, ?, ?, ?)
          `,
          ).run(pid, dh.entry_date, dh.content, dh.updated_at);
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
