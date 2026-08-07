import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { AnnotationRepository } from '../AnnotationRepository';

describe('AnnotationRepository', () => {
  let db: Database.Database;
  let repo: AnnotationRepository;
  let projectId: number;
  let articleId: number;

  beforeEach(() => {
    db = new Database(':memory:');
    const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf-8');
    db.exec(schema);

    repo = new AnnotationRepository(db);

    const projectInfo = db.prepare("INSERT INTO projects (name) VALUES ('Test Project')").run();
    projectId = projectInfo.lastInsertRowid as number;

    const articleInfo = db.prepare("INSERT INTO articles (project_id, title) VALUES (?, 'Test Article')").run(projectId);
    articleId = articleInfo.lastInsertRowid as number;
  });

  afterEach(() => {
    if (db) db.close();
  });

  describe('Annotations', () => {
    it('should save and get annotations', () => {
      const id = repo.saveAnnotation(articleId, 'Test content');
      expect(id).toBeGreaterThan(0);

      const annotations = repo.getAnnotations(articleId);
      expect(annotations).toHaveLength(1);
      expect(annotations[0].content_markdown).toBe('Test content');
      expect(annotations[0].article_id).toBe(articleId);
    });

    it('should not get deleted annotations', () => {
      const id = repo.saveAnnotation(articleId, 'Test content');
      repo.deleteAnnotation(id);

      const annotations = repo.getAnnotations(articleId);
      expect(annotations).toHaveLength(0);
    });
    
    it('should not get annotations for deleted articles or projects', () => {
      const id = repo.saveAnnotation(articleId, 'Test content');
      
      db.prepare("UPDATE projects SET deleted_at = datetime('now') WHERE id = ?").run(projectId);
      expect(repo.getAnnotations(articleId)).toHaveLength(0);
      
      db.prepare("UPDATE projects SET deleted_at = NULL WHERE id = ?").run(projectId);
      expect(repo.getAnnotations(articleId)).toHaveLength(1);
      
      db.prepare("UPDATE articles SET deleted_at = datetime('now') WHERE id = ?").run(articleId);
      expect(repo.getAnnotations(articleId)).toHaveLength(0);
    });

    it('should update annotation', () => {
      const id = repo.saveAnnotation(articleId, 'Test content');
      repo.updateAnnotation(id, 'Updated content');

      const annotations = repo.getAnnotations(articleId);
      expect(annotations[0].content_markdown).toBe('Updated content');
    });
  });

  describe('Highlights', () => {
    it('should save and get highlights without annotation', () => {
      const id = repo.saveHighlight(articleId, '#ff0000', 'pos', 'text');
      expect(id).toBeGreaterThan(0);

      const highlights = repo.getHighlights(articleId);
      expect(highlights).toHaveLength(1);
      expect(highlights[0].color).toBe('#ff0000');
      expect(highlights[0].position_data).toBe('pos');
      expect(highlights[0].content_text).toBe('text');
      expect(highlights[0].comment).toBeNull();
    });

    it('should save and get highlights with annotation', () => {
      const annotationId = repo.saveAnnotation(articleId, 'Comment');
      const id = repo.saveHighlight(articleId, '#00ff00', 'pos2', 'text2', annotationId);

      const highlights = repo.getHighlights(articleId);
      expect(highlights).toHaveLength(1);
      expect(highlights[0].color).toBe('#00ff00');
      expect(highlights[0].comment).toBe('Comment');
    });

    it('should delete highlight without annotation', () => {
      const id = repo.saveHighlight(articleId, '#ff0000', 'pos', 'text');
      repo.deleteHighlight(id);

      const highlights = repo.getHighlights(articleId);
      expect(highlights).toHaveLength(0);
    });

    it('should delete highlight and its annotation', () => {
      const annotationId = repo.saveAnnotation(articleId, 'Comment');
      const id = repo.saveHighlight(articleId, '#00ff00', 'pos2', 'text2', annotationId);

      repo.deleteHighlight(id);

      const highlights = repo.getHighlights(articleId);
      expect(highlights).toHaveLength(0);

      const annotations = repo.getAnnotations(articleId);
      expect(annotations).toHaveLength(0);
    });

    it('should not get highlights for deleted articles or projects', () => {
      repo.saveHighlight(articleId, '#ff0000', 'pos', 'text');
      
      db.prepare("UPDATE projects SET deleted_at = datetime('now') WHERE id = ?").run(projectId);
      expect(repo.getHighlights(articleId)).toHaveLength(0);
      
      db.prepare("UPDATE projects SET deleted_at = NULL WHERE id = ?").run(projectId);
      expect(repo.getHighlights(articleId)).toHaveLength(1);
      
      db.prepare("UPDATE articles SET deleted_at = datetime('now') WHERE id = ?").run(articleId);
      expect(repo.getHighlights(articleId)).toHaveLength(0);
    });
  });

  describe('Pending Highlights', () => {
    it('should save and get pending highlights', () => {
      const id = repo.savePendingHighlight(articleId, 'quote', 'before', 'after', 'comment');
      expect(id).toBeGreaterThan(0);

      const pending = repo.getPendingHighlights(articleId);
      expect(pending).toHaveLength(1);
      expect(pending[0].quote).toBe('quote');
      expect(pending[0].context_before).toBe('before');
      expect(pending[0].context_after).toBe('after');
      expect(pending[0].comment).toBe('comment');
    });

    it('should delete pending highlight', () => {
      const id = repo.savePendingHighlight(articleId, 'quote', 'before', 'after', 'comment');
      repo.deletePendingHighlight(id);

      const pending = repo.getPendingHighlights(articleId);
      expect(pending).toHaveLength(0);
    });
  });
});
