import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { NewProjectPage } from './pages/NewProjectPage'
import { DashboardPage } from './pages/DashboardPage'
import { ProjectDetailsPage } from './pages/ProjectDetailsPage'
import { SearchPage } from './pages/SearchPage'
import { ArticleReaderPage } from './pages/ArticleReaderPage'
import { Layout } from './components/Layout'
import './style.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/new-project" element={<NewProjectPage />} />
          <Route path="/projects/:id" element={<ProjectDetailsPage />} />
          <Route path="/projects/:id/search" element={<SearchPage />} />
          <Route path="/articles/:id" element={<ArticleReaderPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  </StrictMode>,
)
