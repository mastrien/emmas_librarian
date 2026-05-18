import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { NewProjectPage } from './pages/NewProjectPage'
import { DashboardPage } from './pages/DashboardPage'
import { ProjectDetailsPage } from './pages/ProjectDetailsPage'
import { ArticleReaderPage } from './pages/ArticleReaderPage'
import './style.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/new-project" element={<NewProjectPage />} />
        <Route path="/projects/:id" element={<ProjectDetailsPage />} />
        <Route path="/articles/:id" element={<ArticleReaderPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
