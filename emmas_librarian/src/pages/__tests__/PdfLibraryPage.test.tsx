import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { PdfLibraryPage } from '../PdfLibraryPage';
import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import { projectService } from '../../services/api';

const fakeService = FakeProjectService.create();
vi.mock('../../services/api', () => ({
  projectService: {},
}));

describe('PdfLibraryPage', () => {
  beforeEach(() => {
    Object.assign(projectService, fakeService);
    fakeService.reset();
  });

  it('renders correctly', async () => {
    fakeService.getStoredPdfs.mockResolvedValue([]);
    
    render(
      <BrowserRouter>
        <PdfLibraryPage />
      </BrowserRouter>
    );

    expect(await screen.findByText('Biblioteca Global de PDFs')).toBeInTheDocument();
  });
});
