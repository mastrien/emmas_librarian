import { renderHook } from '@testing-library/react';
import React from 'react';
import { describe, it, expect } from 'vitest';
import { ServicesProvider, useProjectService, ServicesContext } from './ServicesContext';
import { projectService } from '../services/api';
import type { IProjectService } from '../services/ProjectServiceInterface';

describe('ServicesContext', () => {
  it('returns default projectService when used without a provider', () => {
    const { result } = renderHook(() => useProjectService());
    expect(result.current).toBe(projectService);
  });

  it('returns injected service when used within ServicesProvider', () => {
    // A fake service for testing
    const fakeService = {
      getProjects: async () => [],
      getProject: async () => null,
      createProject: async () => ({ id: 1, name: 'Fake', description: '', created_at: '', updated_at: '' }),
      updateProject: async () => {},
      deleteProject: async () => {},
      addSourceToProject: async () => {},
      removeSourceFromProject: async () => {},
      getProjectSources: async () => [],
      createPdfArticle: async () => null,
      getArticle: async () => null,
      getArticles: async () => [],
      getCollections: async () => [],
      getPdfUrl: () => 'fake-url',
      updateArticle: async () => null,
      removeArticleFromProject: async () => {},
      addArticleToCollection: async () => {},
      removeArticleFromCollection: async () => {},
      getPdfHighlights: async () => [],
      createPdfHighlight: async () => null,
      updatePdfHighlight: async () => null,
      deletePdfHighlight: async () => {},
    } as unknown as IProjectService;

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ServicesProvider apiService={fakeService}>{children}</ServicesProvider>
    );

    const { result } = renderHook(() => useProjectService(), { wrapper });
    expect(result.current).toBe(fakeService);
  });

  it('throws an error if context is somehow undefined', () => {
    // This is to test the specific branch in useProjectService where ctx is falsy.
    // The only way to simulate this is by explicitly passing undefined via the Provider.
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ServicesContext.Provider value={undefined as unknown as IProjectService}>
        {children}
      </ServicesContext.Provider>
    );

    const consoleError = console.error;
    console.error = () => {};
    expect(() => renderHook(() => useProjectService(), { wrapper })).toThrowError(
      'useProjectService must be used within a <ServicesProvider>. Received context value: undefined'
    );
    console.error = consoleError;
  });
});
