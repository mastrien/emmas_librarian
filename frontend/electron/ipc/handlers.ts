import { ipcMain, app, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { DatabaseManager } from '../database/DatabaseManager';
import { SearchOrchestrator } from '../services/SearchOrchestrator';
import { queryTranslator } from '../services/QueryTranslator';
import { QueryTranslator } from '../services/QueryTranslator';
import { ApiIntegrator } from '../services/ApiIntegrator';
import { IpcChannel } from '../types';
import { QueryBlock } from '../services/types';

export function setupIpcHandlers() {
  const dbPath = path.join(app.getPath('userData'), 'emma.db');
  const db = new DatabaseManager(dbPath);
  const translator = new QueryTranslator();
  const api = new ApiIntegrator();
  const orchestrator = new SearchOrchestrator(db, translator, api);

  // Projects
  ipcMain.handle(IpcChannel.PROJECTS_GET_ALL, () => {
    return db.getAllProjects();
  });

  ipcMain.handle(IpcChannel.PROJECTS_CREATE, (event, name: string) => {
    return db.createProject(name);
  });

  ipcMain.handle(IpcChannel.PROJECTS_GET_ONE, async (event, projectId: number) => {
    return db.getProject(projectId);
  });

  ipcMain.handle(IpcChannel.PROJECTS_GET_SEARCH_HISTORY, async (event, projectId: number) => {
    return db.getSearchHistory(projectId);
  });

  ipcMain.handle(IpcChannel.PROJECTS_UPDATE, async (event, id: number, name: string) => {
    return db.updateProject(id, name);
  });

  ipcMain.handle(IpcChannel.PROJECTS_DELETE, async (event, id: number) => {
    return db.deleteProject(id);
  });

  // Search
  ipcMain.handle(IpcChannel.SEARCH_EXECUTE, async (event, projectId: number, queryMap: Record<string, string>, limit: number, sortBy: string, unifiedQuery: string) => {
    return orchestrator.searchAndPersist(projectId, queryMap, limit, sortBy as any, unifiedQuery);
  });

  ipcMain.handle(IpcChannel.SEARCH_TRANSLATE_QUERY, (event, ast: any) => {
    return queryTranslator.translate(ast);
  });

  // Articles
  ipcMain.handle(IpcChannel.ARTICLES_GET_BY_PROJECT, (event, projectId: number) => {
    return db.getArticlesByProject(projectId);
  });

  ipcMain.handle(IpcChannel.ARTICLES_GET_ONE, (event, id: number) => {
    return db.getArticle(id);
  });

  ipcMain.handle(IpcChannel.ARTICLES_UPDATE_STATUS, (event, id: number, status: 'new' | 'read' | 'archived', note?: string) => {
    return db.updateArticleStatus(id, status, note);
  });

  // Settings
  ipcMain.handle(IpcChannel.SETTINGS_GET, (event, key: string) => {
    return db.getSetting(key);
  });

  ipcMain.handle(IpcChannel.SETTINGS_SET, (event, key: string, value: string) => {
    return db.setSetting(key, value);
  });

  // Annotations
  ipcMain.handle(IpcChannel.ANNOTATIONS_GET, (event, articleId: number) => {
    return db.getAnnotations(articleId);
  });

  ipcMain.handle(IpcChannel.ANNOTATIONS_CREATE, (event, articleId: number, content: string) => {
    return db.saveAnnotation(articleId, content);
  });

  ipcMain.handle(IpcChannel.ANNOTATIONS_UPDATE, (event, id: number, content: string) => {
    return db.updateAnnotation(id, content);
  });

  ipcMain.handle(IpcChannel.ANNOTATIONS_DELETE, (event, id: number) => {
    return db.deleteAnnotation(id);
  });

  // Highlights
  ipcMain.handle(IpcChannel.HIGHLIGHTS_GET, (event, articleId: number) => {
    return db.getHighlights(articleId);
  });

  ipcMain.handle(IpcChannel.HIGHLIGHTS_CREATE, (event, articleId: number, color: string, positionData: string, content?: string) => {
    let annId;
    if (content) {
      annId = db.saveAnnotation(articleId, content);
    }
    return db.saveHighlight(articleId, color, positionData, annId);
  });

  ipcMain.handle(IpcChannel.HIGHLIGHTS_DELETE, (event, id: number) => {
    return db.deleteHighlight(id);
  });

  // PDF
  ipcMain.handle(IpcChannel.PDF_UPLOAD, async (event, articleId: number, sourceFilePath: string) => {
    const pdfsDir = path.join(app.getPath('userData'), 'storage', 'pdfs');
    if (!fs.existsSync(pdfsDir)) {
      fs.mkdirSync(pdfsDir, { recursive: true });
    }
    const destPath = path.join(pdfsDir, `${articleId}_${Date.now()}.pdf`);
    fs.copyFileSync(sourceFilePath, destPath);
    db.updateArticleFilePath(articleId, destPath);
    return destPath;
  });

  ipcMain.handle(IpcChannel.PDF_GET, async (event, articleId: number) => {
    const article = db.getArticle(articleId);
    if (!article || !article.local_file_path || !fs.existsSync(article.local_file_path)) {
      throw new Error("PDF not found");
    }
    const buffer = fs.readFileSync(article.local_file_path);
    return buffer;
  });

  ipcMain.handle(IpcChannel.PDF_UNLINK, async (event, articleId: number) => {
    const article = db.getArticle(articleId);
    if (article && article.local_file_path) {
      try {
        if (fs.existsSync(article.local_file_path)) {
          fs.unlinkSync(article.local_file_path);
        }
      } catch (err) {
        console.error("Failed to delete physical PDF file:", err);
      }
      db.updateArticleFilePath(articleId, null);
    }
  });

  ipcMain.handle(IpcChannel.ARTICLES_CREATE_MANUAL, async (event, projectId: number, data: any, sourceFilePath?: string) => {
    const articleId = db.saveArticle(projectId, {
      title: data.title,
      authors: data.authors || '',
      year: data.year ? parseInt(data.year) : undefined,
      doi: data.doi || undefined,
      abstract: data.abstract || undefined,
      journal: data.journal || undefined,
      source_query: 'Manual Import',
      source_databases: JSON.stringify(['Manual']),
      csl_json: JSON.stringify({}),
    });

    if (sourceFilePath) {
      try {
        const pdfsDir = path.join(app.getPath('userData'), 'storage', 'pdfs');
        if (!fs.existsSync(pdfsDir)) {
          fs.mkdirSync(pdfsDir, { recursive: true });
        }
        const destPath = path.join(pdfsDir, `${articleId}_${Date.now()}.pdf`);
        fs.copyFileSync(sourceFilePath, destPath);
        db.updateArticleFilePath(articleId, destPath);
      } catch (err) {
        console.error("Failed to copy PDF file for manual article:", err);
      }
    }

    try {
      db.saveSearchHistory(
        projectId,
        `Adição manual de artigo avulso: ${data.title}`,
        {},
        1,
        { "Manual": { "count": 1 } }
      );
    } catch (err) {
      console.error("Failed to log manual article creation to search history:", err);
    }

    return articleId;
  });

  // CSV Export
  ipcMain.handle(IpcChannel.EXPORT_CSV, async (event, projectId: number) => {
    const project = db.getProject(projectId);
    const articles = db.getArticlesByProject(projectId);
    
    if (!project) throw new Error("Project not found");

    const header = ["id", "doi", "title", "authors", "year", "source", "status"];
    const rows = articles.map(a => [
      a.id,
      a.doi || '',
      `"${(a.title || '').replace(/"/g, '""')}"`,
      `"${(a.authors || '').replace(/"/g, '""')}"`,
      a.year || '',
      `"${(a.source_databases || '').replace(/"/g, '""')}"`,
      a.status
    ]);
    const csvContent = [header.join(','), ...rows.map(r => r.join(','))].join('\n');

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Articles CSV',
      defaultPath: `project_${projectId}_export.csv`,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    });

    if (!canceled && filePath) {
      fs.writeFileSync(filePath, csvContent);
      return filePath;
    }
    return null;
  });

  // Dialog for file open
  ipcMain.handle(IpcChannel.DIALOG_OPEN_FILE, async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });
    if (!canceled && filePaths.length > 0) {
      return filePaths[0];
    }
    return null;
  });

  // Diary
  ipcMain.handle(IpcChannel.DIARY_GET_ALL, (event, projectId: number) => {
    return db.getDiaryEntries(projectId);
  });

  ipcMain.handle(IpcChannel.DIARY_GET_ONE, (event, projectId: number, entryDate: string) => {
    return db.getDiaryEntry(projectId, entryDate);
  });

  ipcMain.handle(IpcChannel.DIARY_SAVE, (event, projectId: number, entryDate: string, content: string) => {
    return db.saveDiaryEntry(projectId, entryDate, content);
  });

  ipcMain.handle(IpcChannel.DIARY_DELETE, (event, projectId: number, entryDate: string) => {
    return db.deleteDiaryEntry(projectId, entryDate);
  });

  // Biblioshiny Export (Scopus CSV format — exact 45-column layout from real Scopus export)
  ipcMain.handle(IpcChannel.EXPORT_BIBLIOSHINY, async (event, projectId: number) => {
    const project = db.getProject(projectId);
    const articles = db.getArticlesByProject(projectId);
    
    if (!project) throw new Error("Project not found");

    // Exact column order from a real Scopus CSV export (45 columns)
    const headers = [
      "Authors",                      //  1
      "Author full names",            //  2
      "Author(s) ID",                 //  3
      "Title",                        //  4
      "Year",                         //  5
      "Source title",                  //  6
      "Volume",                       //  7
      "Issue",                        //  8
      "Art. No.",                     //  9
      "Page start",                   // 10
      "Page end",                     // 11
      "Cited by",                     // 12
      "DOI",                          // 13
      "Link",                         // 14
      "Affiliations",                 // 15
      "Authors with affiliations",    // 16
      "Abstract",                     // 17
      "Author Keywords",              // 18
      "Index Keywords",               // 19
      "Molecular Sequence Numbers",   // 20
      "Chemicals/CAS",                // 21
      "Tradenames",                   // 22
      "Manufacturers",                // 23
      "Funding Details",              // 24
      "Funding Texts",                // 25
      "References",                   // 26
      "Correspondence Address",       // 27
      "Editors",                      // 28
      "Publisher",                     // 29
      "Sponsors",                     // 30
      "Conference name",              // 31
      "Conference date",              // 32
      "Conference location",          // 33
      "Conference code",              // 34
      "ISSN",                         // 35
      "ISBN",                         // 36
      "CODEN",                        // 37
      "PubMed ID",                    // 38
      "Language of Original Document",// 39
      "Abbreviated Source Title",     // 40
      "Document Type",                // 41
      "Publication Stage",            // 42
      "Open Access",                  // 43
      "Source",                       // 44
      "EID"                           // 45
    ];

    // Escape CSV value: quote everything, double-escape internal quotes, strip newlines
    const escCsv = (val: any) => {
      const str = String(val ?? '').replace(/\r?\n/g, ' ').replace(/\r/g, ' ').replace(/"/g, '""');
      return `"${str}"`;
    };

    // Format authors for Biblioshiny
    const formatAuthors = (authorsStr: string, abbreviate: boolean): string => {
      if (!authorsStr) return '';
      const separator = authorsStr.includes(';') ? ';' : ',';
      const names = authorsStr.split(separator);
      
      const formatted = names.map(name => {
        const trimmed = name.trim();
        if (!trimmed) return '';
        
        let lastName = '';
        let firstName = '';
        
        if (trimmed.includes(',')) {
          const commaIdx = trimmed.indexOf(',');
          lastName = trimmed.substring(0, commaIdx).trim();
          firstName = trimmed.substring(commaIdx + 1).trim();
        } else {
          const parts = trimmed.split(/\s+/).filter(Boolean);
          if (parts.length === 0) return '';
          if (parts.length === 1) {
            lastName = parts[0];
            firstName = '';
          } else {
            const lastPart = parts[parts.length - 1];
            const cleanLast = lastPart.replace(/[^a-zA-Z]/g, '');
            if (cleanLast.length > 0 && cleanLast.length <= 2 && lastPart === lastPart.toUpperCase()) {
              lastName = parts.slice(0, parts.length - 1).join(' ');
              firstName = cleanLast.split('').join(' ');
            } else {
              lastName = parts[parts.length - 1];
              firstName = parts.slice(0, parts.length - 1).join(' ');
            }
          }
        }
        
        if (abbreviate) {
          const initials = firstName
            .split(/[\s-]+/)
            .map(part => part.replace(/[^a-zA-Z]/g, '').trim().charAt(0).toUpperCase())
            .filter(Boolean)
            .join('');
          return initials ? `${lastName} ${initials}.` : lastName;
        } else {
          return firstName ? `${lastName}, ${firstName}` : lastName;
        }
      }).filter(Boolean);
      
      return formatted.join('; ');
    };

    const getAuthorsWithAffiliations = (authorsStr: string, affiliationsStr: string): string => {
      if (!authorsStr) return '';
      const formattedAuthors = formatAuthors(authorsStr, true);
      if (!affiliationsStr) return '';
      const authorList = formattedAuthors.split(';').map(s => s.trim()).filter(Boolean);
      return authorList.map(auth => `${auth}, ${affiliationsStr}`).join('; ');
    };

    const cleanDoi = (doiStr: string): string => {
      if (!doiStr) return '';
      return doiStr.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').trim();
    };

    const rows = articles.map(a => {
      const pageStart = a.pages?.split('-')[0] || '';
      const pageEnd = a.pages?.split('-')[1] || '';
      const cleanedDoi = cleanDoi(a.doi || '');
      return [
        escCsv(formatAuthors(a.authors || '', true)),                //  1 Authors
        escCsv(formatAuthors(a.authors || '', false)),               //  2 Author full names
        escCsv(''),                                                 //  3 Author(s) ID
        escCsv(a.title || ''),                                      //  4 Title
        escCsv(a.year || ''),                                       //  5 Year
        escCsv(a.journal || ''),                                    //  6 Source title
        escCsv(a.volume || ''),                                     //  7 Volume
        escCsv(a.issue || ''),                                      //  8 Issue
        escCsv(''),                                                 //  9 Art. No.
        escCsv(pageStart),                                          // 10 Page start
        escCsv(pageEnd),                                            // 11 Page end
        escCsv(a.citation_count ?? ''),                             // 12 Cited by
        escCsv(cleanedDoi),                                         // 13 DOI
        escCsv(cleanedDoi ? `https://doi.org/${cleanedDoi}` : ''),   // 14 Link
        escCsv(a.affiliations || ''),                               // 15 Affiliations
        escCsv(getAuthorsWithAffiliations(a.authors || '', a.affiliations || '')), // 16 Authors with affiliations
        escCsv(a.abstract || ''),                                   // 17 Abstract
        escCsv(a.author_keywords || ''),                            // 18 Author Keywords
        escCsv(a.index_keywords || ''),                             // 19 Index Keywords
        escCsv(''),                                                 // 20 Molecular Sequence Numbers
        escCsv(''),                                                 // 21 Chemicals/CAS
        escCsv(''),                                                 // 22 Tradenames
        escCsv(''),                                                 // 23 Manufacturers
        escCsv(''),                                                 // 24 Funding Details
        escCsv(''),                                                 // 25 Funding Texts
        escCsv(a.references_list || ''),                            // 26 References
        escCsv(''),                                                 // 27 Correspondence Address
        escCsv(''),                                                 // 28 Editors
        escCsv(''),                                                 // 29 Publisher
        escCsv(''),                                                 // 30 Sponsors
        escCsv(''),                                                 // 31 Conference name
        escCsv(''),                                                 // 32 Conference date
        escCsv(''),                                                 // 33 Conference location
        escCsv(''),                                                 // 34 Conference code
        escCsv(a.issn || ''),                                       // 35 ISSN
        escCsv(''),                                                 // 36 ISBN
        escCsv(''),                                                 // 37 CODEN
        escCsv(''),                                                 // 38 PubMed ID
        escCsv('English'),                                          // 39 Language of Original Document
        escCsv(''),                                                 // 40 Abbreviated Source Title
        escCsv(a.document_type || 'Article'),                       // 41 Document Type
        escCsv('Final'),                                            // 42 Publication Stage
        escCsv(''),                                                 // 43 Open Access
        escCsv('Scopus'),                                           // 44 Source
        escCsv(`2-s2.0-${a.id}`)                                    // 45 EID
      ].join(',');
    });

    // UTF-8 BOM + CRLF line endings (matching real Scopus export format)
    const bom = '\uFEFF';
    const csvContent = bom + [headers.map(h => escCsv(h)).join(','), ...rows].join('\r\n');

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Exportar para Biblioshiny',
      defaultPath: `${project.name}_biblioshiny.csv`,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    });

    if (!canceled && filePath) {
      fs.writeFileSync(filePath, csvContent, 'utf-8');
      return filePath;
    }
    return null;
  });
}
