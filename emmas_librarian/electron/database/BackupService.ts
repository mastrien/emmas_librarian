import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import { DatabaseAdapter } from './DatabaseAdapter';
import { dialog, app } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import BetterSqlite3 from 'better-sqlite3';

export class BackupService {
  constructor(private dbAdapter: DatabaseAdapter) {}



  public async exportBackup(): Promise<string | null> {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Exportar Backup Completo',
      defaultPath: `backup_${new Date().toISOString().split('T')[0]}.emmabak`,
      filters: [{ name: "Emma's Librarian Backup", extensions: ['emmabak'] }],
    });

    if (canceled || !filePath) return null;

    try {
      const dbPath = path.join(app.getPath('userData'), 'emma.db');
      const basePdfsDir = path.join(app.getPath('userData'), 'storage', 'pdfs');
      const baseDocsDir = path.join(app.getPath('userData'), 'storage', 'project_documents');

      const zip = new AdmZip();

      // 1. Flush WAL to main db file before reading, to ensure backup is consistent
      const db = (this.dbAdapter as any).getDB ? (this.dbAdapter as any).getDB() : (this.dbAdapter as any).db;
      db.pragma('wal_checkpoint(TRUNCATE)');

      // 2. Copy db file to zip
      if (fs.existsSync(dbPath)) {
        zip.addFile('emma.db', fs.readFileSync(dbPath));
      }

      // 3. Add PDFs
      if (fs.existsSync(basePdfsDir)) {
        zip.addLocalFolder(basePdfsDir, 'storage/pdfs');
      }

      // 4. Add Project Documents
      if (fs.existsSync(baseDocsDir)) {
        zip.addLocalFolder(baseDocsDir, 'storage/project_documents');
      }

      // 5. Add metadata file
      const projectCount = db.prepare('SELECT count(*) as count FROM projects WHERE deleted_at IS NULL').get().count;
      const articleCount = db.prepare('SELECT count(*) as count FROM articles WHERE deleted_at IS NULL').get().count;

      const metadata = {
        date: new Date().toISOString(),
        version: app.getVersion(),
        projectCount,
        articleCount,
      };
      zip.addFile('backup_metadata.json', Buffer.from(JSON.stringify(metadata, null, 2), 'utf-8'));

      zip.writeZip(filePath);
      return filePath;
    } catch (err) {
      console.error('Erro ao exportar backup:', err);
      throw err;
    }
  }



  public async restoreBackupOverride(providedPath?: string): Promise<boolean> {
    let importPath = providedPath;

    if (!importPath) {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Restaurar Backup Completo (Sobrescrever)',
        filters: [{ name: "Emma's Librarian Backup", extensions: ['emmabak'] }],
        properties: ['openFile'],
      });

      if (canceled || filePaths.length === 0) return false;
      importPath = filePaths[0];
    }

    try {
      const zip = new AdmZip(importPath);
      const dbEntry = zip.getEntry('emma.db');
      if (!dbEntry) throw new Error('Arquivo de backup inválido (não contém emma.db)');

      // 1. Checkpoint WAL to ensure main db file is up-to-date, then close connection
      this.dbAdapter.checkpoint();
      this.dbAdapter.close();

      // 2. Overwrite emma.db
      const dbPath = path.join(app.getPath('userData'), 'emma.db');
      // If there are WAL/shm files, delete them too to avoid conflicts
      const walPath = `${dbPath}-wal`;
      const shmPath = `${dbPath}-shm`;
      if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

      fs.writeFileSync(dbPath, dbEntry.getData());

      // 3. Extract PDFs and Docs
      const baseDir = app.getPath('userData');

      const zipEntries = zip.getEntries();
      for (const entry of zipEntries) {
        if (entry.entryName.startsWith('storage/pdfs/') && !entry.isDirectory) {
          const dest = path.join(baseDir, entry.entryName);
          const destDir = path.dirname(dest);
          if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
          fs.writeFileSync(dest, entry.getData());
        } else if (entry.entryName.startsWith('storage/project_documents/') && !entry.isDirectory) {
          const dest = path.join(baseDir, entry.entryName);
          const destDir = path.dirname(dest);
          if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
          fs.writeFileSync(dest, entry.getData());
        }
      }

      // 4. Relaunch app
      app.relaunch();
      app.exit(0);

      return true;
    } catch (err) {
      console.error('Erro ao restaurar backup:', err);
      throw err;
    }
  }



  public async restoreBackupMerge(providedPath?: string): Promise<number> {
    let importPath = providedPath;

    if (!importPath) {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Importar e Mesclar Backup',
        filters: [{ name: "Emma's Librarian Backup", extensions: ['emmabak'] }],
        properties: ['openFile'],
      });

      if (canceled || filePaths.length === 0) return 0;
      importPath = filePaths[0];
    }

    const tempDir = path.join(app.getPath('userData'), 'temp_restore_' + uuidv4());
    let tempDb: BetterSqlite3.Database | null = null;
    try {
      const zip = new AdmZip(importPath);
      const dbEntry = zip.getEntry('emma.db');
      if (!dbEntry) throw new Error('Arquivo de backup inválido (não contém emma.db)');

      // Extract temp db
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      const tempDbPath = path.join(tempDir, 'temp_emma.db');
      fs.writeFileSync(tempDbPath, dbEntry.getData());

      // Open temp db
      tempDb = new BetterSqlite3(tempDbPath);

      // Run migrations on temp db to guarantee it has the current schema
      const tempMigrations = [
        'ALTER TABLE articles ADD COLUMN archive_note TEXT',
        'ALTER TABLE articles ADD COLUMN abstract TEXT',
        'ALTER TABLE articles ADD COLUMN author_keywords TEXT',
        'ALTER TABLE articles ADD COLUMN index_keywords TEXT',
        'ALTER TABLE articles ADD COLUMN journal TEXT',
        'ALTER TABLE articles ADD COLUMN volume TEXT',
        'ALTER TABLE articles ADD COLUMN issue TEXT',
        'ALTER TABLE articles ADD COLUMN pages TEXT',
        'ALTER TABLE articles ADD COLUMN affiliations TEXT',
        'ALTER TABLE articles ADD COLUMN references_list TEXT',
        'ALTER TABLE articles ADD COLUMN document_type TEXT',
        'ALTER TABLE articles ADD COLUMN issn TEXT',
        'ALTER TABLE articles ADD COLUMN citation_count INTEGER',
        'ALTER TABLE articles ADD COLUMN search_id INTEGER REFERENCES search_history(id) ON DELETE SET NULL',
        'ALTER TABLE articles ADD COLUMN ai_summary TEXT',
        'ALTER TABLE projects ADD COLUMN writing_pad TEXT',
        'ALTER TABLE articles ADD COLUMN is_oa INTEGER',
        'ALTER TABLE articles ADD COLUMN publisher TEXT',
        'ALTER TABLE articles ADD COLUMN url TEXT',
        'ALTER TABLE articles ADD COLUMN accessed TEXT',
        'ALTER TABLE projects ADD COLUMN deleted_at DATETIME DEFAULT NULL',
        'ALTER TABLE articles ADD COLUMN deleted_at DATETIME DEFAULT NULL',
        'ALTER TABLE annotations ADD COLUMN deleted_at DATETIME DEFAULT NULL',
        `CREATE TABLE IF NOT EXISTS project_diary_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            entry_date TEXT NOT NULL,
            content TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )`,
        'ALTER TABLE search_history ADD COLUMN sort_by TEXT',
        'ALTER TABLE search_history ADD COLUMN limit_val INTEGER',
      ];
      for (const sql of tempMigrations) {
        try {
          tempDb.exec(sql);
        } catch (e) {
          /* ignore if already exists */
        }
      }

      // Add options column to project_categories if missing
      try {
        const pcInfo = tempDb.pragma('table_info(project_categories)') as any[];
        if (pcInfo && !pcInfo.some((col) => col.name === 'options')) {
          tempDb.exec(`ALTER TABLE project_categories ADD COLUMN options TEXT;`);
        }
      } catch (e) {}

      // Add other columns if missing
      try {
        const miInfo = tempDb.pragma('table_info(massive_investigations)') as any[];
        if (miInfo && miInfo.length > 0) {
          if (!miInfo.some((col) => col.name === 'model_used')) {
            tempDb.prepare('ALTER TABLE massive_investigations ADD COLUMN model_used TEXT').run();
          }
          if (!miInfo.some((col) => col.name === 'status')) {
            tempDb.prepare('ALTER TABLE massive_investigations ADD COLUMN status TEXT').run();
          }
        }
      } catch (e) {}

      try {
        const hlInfo = tempDb.pragma('table_info(highlights)') as any[];
        if (hlInfo && hlInfo.length > 0) {
          if (!hlInfo.some((col) => col.name === 'content_text')) {
            tempDb.prepare('ALTER TABLE highlights ADD COLUMN content_text TEXT').run();
          }
        }
      } catch (e) {}

      // Active db
      const activeDb = (this.dbAdapter as any).getDB ? (this.dbAdapter as any).getDB() : (this.dbAdapter as any).db;

      // Get active projects
      const existingProjNames = new Set(
        activeDb
          .prepare('SELECT name FROM projects WHERE deleted_at IS NULL')
          .all()
          .map((p: any) => p.name),
      );

      // Get projects from temp db
      const tempProjects = tempDb.prepare('SELECT * FROM projects WHERE deleted_at IS NULL').all() as any[];

      let importedCount = 0;

      const basePdfsDir = path.join(app.getPath('userData'), 'storage', 'pdfs');
      if (!fs.existsSync(basePdfsDir)) fs.mkdirSync(basePdfsDir, { recursive: true });

      const baseDocsDir = path.join(app.getPath('userData'), 'storage', 'project_documents');
      if (!fs.existsSync(baseDocsDir)) fs.mkdirSync(baseDocsDir, { recursive: true });

      for (const tempProj of tempProjects) {
        if (existingProjNames.has(tempProj.name)) {
          // Already exists, skip
          continue;
        }

        const projectId = tempProj.id;

        // Query data from tempDb
        const articles = tempDb.prepare('SELECT * FROM articles WHERE project_id = ?').all(projectId) as any[];
        const searchHistory = tempDb
          .prepare('SELECT * FROM search_history WHERE project_id = ?')
          .all(projectId) as any[];
        const projectDocs = tempDb
          .prepare('SELECT * FROM project_documents WHERE project_id = ?')
          .all(projectId) as any[];
        const massiveInvs = tempDb
          .prepare('SELECT * FROM massive_investigations WHERE project_id = ?')
          .all(projectId) as any[];
        const projCategories = tempDb
          .prepare('SELECT * FROM project_categories WHERE project_id = ?')
          .all(projectId) as any[];

        const articleCategories = tempDb
          .prepare(
            `
          SELECT ac.* FROM article_categories ac
          JOIN project_categories pc ON ac.category_id = pc.id
          WHERE pc.project_id = ?
        `,
          )
          .all(projectId) as any[];

        const annotations = tempDb
          .prepare(
            `
          SELECT a.* FROM annotations a
          JOIN articles art ON a.article_id = art.id
          WHERE art.project_id = ?
        `,
          )
          .all(projectId) as any[];

        const highlights = tempDb
          .prepare(
            `
          SELECT h.* FROM highlights h
          JOIN articles art ON h.article_id = art.id
          WHERE art.project_id = ?
        `,
          )
          .all(projectId) as any[];

        const pendingHighlights = tempDb
          .prepare(
            `
          SELECT ph.* FROM pending_highlights ph
          JOIN articles art ON ph.article_id = art.id
          WHERE art.project_id = ?
        `,
          )
          .all(projectId) as any[];

        const diaryEntries = tempDb
          .prepare('SELECT * FROM project_diary WHERE project_id = ?')
          .all(projectId) as any[];

        // Run insertion in activeDb transaction
        activeDb.transaction(() => {
          const insertProj = activeDb.prepare('INSERT INTO projects (name, created_at) VALUES (?, ?)');
          const projResult = insertProj.run(tempProj.name, tempProj.created_at);
          const pid = projResult.lastInsertRowid;

          const articleMap = new Map<number, number>();

          // Insert Articles
          for (const art of articles) {
            let newPdfPath = null;
            if (art.local_file_path) {
              const fileName = path.basename(art.local_file_path);
              const pdfEntry = zip.getEntry(`storage/pdfs/${fileName}`);
              if (pdfEntry) {
                const destPath = path.join(basePdfsDir, `${uuidv4()}_${fileName}`);
                fs.writeFileSync(destPath, pdfEntry.getData());
                newPdfPath = destPath;
              }
            }

            const insertArt = activeDb.prepare(`
              INSERT INTO articles (
                project_id, doi, title, authors, year, source_query, source_databases, 
                csl_json, local_file_path, status, archive_note, url, accessed, deleted_at, ai_summary
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
              art.url,
              art.accessed,
              art.deleted_at,
              art.ai_summary,
            );
            articleMap.set(art.id, artRes.lastInsertRowid);
          }

          // Insert Search History
          for (const sh of searchHistory) {
            activeDb
              .prepare(
                `
              INSERT INTO search_history (
                project_id, unified_query, translated_queries, total_results, results_breakdown, sort_by, limit_val
              ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
              )
              .run(
                pid,
                sh.unified_query,
                sh.translated_queries,
                sh.total_results,
                sh.results_breakdown,
                sh.sort_by || null,
                sh.limit_val ?? null,
              );
          }

          // Insert Project Docs
          for (const doc of projectDocs) {
            let newDocPath = null;
            if (doc.local_file_path) {
              const fileName = path.basename(doc.local_file_path);
              const docEntry = zip.getEntry(`storage/project_documents/${fileName}`);
              if (docEntry) {
                const destPath = path.join(baseDocsDir, `${uuidv4()}_${fileName}`);
                fs.writeFileSync(destPath, docEntry.getData());
                newDocPath = destPath;
              }
            }

            activeDb
              .prepare(
                `
              INSERT INTO project_documents (project_id, title, url, local_file_path)
              VALUES (?, ?, ?, ?)
            `,
              )
              .run(pid, doc.title, doc.url, newDocPath);
          }

          // Insert Project Categories and mapping
          const categoryMap = new Map<number, number>();
          for (const cat of projCategories) {
            const res = activeDb
              .prepare(
                `
              INSERT INTO project_categories (project_id, name, type, options)
              VALUES (?, ?, ?, ?)
            `,
              )
              .run(pid, cat.name, cat.type, cat.options);
            categoryMap.set(cat.id, res.lastInsertRowid);
          }

          // Insert Article Categories
          for (const ac of articleCategories) {
            const newArtId = articleMap.get(ac.article_id);
            const newCatId = categoryMap.get(ac.category_id);
            if (newArtId && newCatId) {
              activeDb
                .prepare(
                  `
                INSERT INTO article_categories (article_id, category_id, value)
                VALUES (?, ?, ?)
              `,
                )
                .run(newArtId, newCatId, ac.value);
            }
          }

          // Massive Investigations
          for (const mi of massiveInvs) {
            const res = activeDb
              .prepare(
                `
              INSERT INTO massive_investigations (
                project_id, created_at, status, model_used, questions, articles_ids
              ) VALUES (?, ?, ?, ?, ?, ?)
            `,
              )
              .run(pid, mi.created_at, mi.status, mi.model_used, mi.questions, mi.articles_ids);
            const miId = res.lastInsertRowid;

            try {
              const oldIds: number[] = JSON.parse(mi.articles_ids);
              const newIds = oldIds.map((id) => articleMap.get(id)).filter(Boolean);
              activeDb
                .prepare('UPDATE massive_investigations SET articles_ids = ? WHERE id = ?')
                .run(JSON.stringify(newIds), miId);
            } catch (e) {
              // ignore
            }
          }

          // Insert Annotations
          const annotationMap = new Map<number, number>();
          for (const ann of annotations) {
            const newArtId = articleMap.get(ann.article_id);
            if (newArtId) {
              const res = activeDb
                .prepare(
                  `
                INSERT INTO annotations (article_id, content_markdown, created_at, deleted_at)
                VALUES (?, ?, ?, ?)
              `,
                )
                .run(newArtId, ann.content_markdown, ann.created_at, ann.deleted_at);
              annotationMap.set(ann.id, res.lastInsertRowid);
            }
          }

          // Insert Highlights
          for (const hl of highlights) {
            const newArtId = articleMap.get(hl.article_id);
            if (newArtId) {
              const newAnnId = hl.annotation_id ? annotationMap.get(hl.annotation_id) : null;
              activeDb
                .prepare(
                  `
                INSERT INTO highlights (article_id, color, position_data, content_text, annotation_id)
                VALUES (?, ?, ?, ?, ?)
              `,
                )
                .run(newArtId, hl.color, hl.position_data, hl.content_text, newAnnId);
            }
          }

          // Insert Pending Highlights
          for (const ph of pendingHighlights) {
            const newArtId = articleMap.get(ph.article_id);
            if (newArtId) {
              activeDb
                .prepare(
                  `
                INSERT INTO pending_highlights (article_id, quote, context_before, context_after, comment, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
              `,
                )
                .run(newArtId, ph.quote, ph.context_before, ph.context_after, ph.comment, ph.created_at);
            }
          }

          // Insert Diary Entries
          for (const de of diaryEntries) {
            activeDb
              .prepare(
                `
              INSERT OR REPLACE INTO project_diary (project_id, entry_date, content)
              VALUES (?, ?, ?)
            `,
              )
              .run(pid, de.entry_date, de.content);
          }
        })();

        importedCount++;
      }

      return importedCount;
    } catch (err) {
      console.error('Erro ao mesclar backup:', err);
      throw err;
    } finally {
      if (tempDb) {
        try {
          tempDb.close();
        } catch (e) {
          console.error('Erro ao fechar tempDb:', e);
        }
      }
      // Clean up temp dir
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (e) {
        console.error('Erro ao deletar pasta temporária:', e);
      }
    }
  }
}
