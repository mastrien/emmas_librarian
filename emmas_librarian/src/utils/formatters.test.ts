import { describe, it, expect } from 'vitest';
import { getArticleStatusColor, getArticleStatusLabel, formatDate } from './formatters';

describe('formatters', () => {
  describe('getArticleStatusColor', () => {
    it('returns #10b981 for "read" status', () => {
      expect(getArticleStatusColor('read')).toBe('#10b981');
    });

    it('returns #6b7280 for "archived" status', () => {
      expect(getArticleStatusColor('archived')).toBe('#6b7280');
    });

    it('returns #3b82f6 for "new" status', () => {
      expect(getArticleStatusColor('new')).toBe('#3b82f6');
    });

    it('returns #6b7280 for unknown status', () => {
      expect(getArticleStatusColor('unknown_status')).toBe('#6b7280');
    });

    it('returns #6b7280 for undefined status', () => {
      expect(getArticleStatusColor(undefined)).toBe('#6b7280');
    });
  });

  describe('getArticleStatusLabel', () => {
    it('returns "Lido" for "read" status', () => {
      expect(getArticleStatusLabel('read')).toBe('Lido');
    });

    it('returns "Arquivado" for "archived" status', () => {
      expect(getArticleStatusLabel('archived')).toBe('Arquivado');
    });

    it('returns "Novo" for "new" status', () => {
      expect(getArticleStatusLabel('new')).toBe('Novo');
    });

    it('returns "Desconhecido" for unknown status', () => {
      expect(getArticleStatusLabel('unknown_status')).toBe('Desconhecido');
    });

    it('returns "Desconhecido" for undefined status', () => {
      expect(getArticleStatusLabel(undefined)).toBe('Desconhecido');
    });
  });

  describe('formatDate', () => {
    it('returns "-" for undefined dateString', () => {
      expect(formatDate(undefined)).toBe('-');
    });

    it('returns "-" for empty dateString', () => {
      expect(formatDate('')).toBe('-');
    });

    it('formats valid date string to locale date string', () => {
      const dateStr = '2023-12-01T10:00:00Z';
      const expectedDate = new Date(dateStr).toLocaleDateString('pt-BR');
      expect(formatDate(dateStr)).toBe(expectedDate);
    });

    it('returns original string if date is invalid', () => {
      expect(formatDate('invalid-date')).toBe('invalid-date');
    });
  });
});
