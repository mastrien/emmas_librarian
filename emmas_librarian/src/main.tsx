// PrismJS is loaded externally via <script> tags in index.html
// to ensure correct initialization order in production builds.
// See public/vendor/prismjs/ and the error report in relatorio_erro_prism.md.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { NewProjectPage } from './pages/NewProjectPage'
import { DashboardPage } from './pages/DashboardPage'
import { ProjectDetailsPage } from './pages/ProjectDetailsPage'
import { SearchPage } from './pages/SearchPage'
import { ArticleReaderPage } from './pages/ArticleReaderPage'
import { SettingsPage } from './pages/SettingsPage'
import { TermsOfUsePage } from './pages/TermsOfUsePage'
import { Layout } from './components/Layout'
import './style.css'

// Initialize theme and accent
const savedTheme = localStorage.getItem('theme') || 'light';
const savedAccent = localStorage.getItem('accent') || 'blue';
document.documentElement.setAttribute('data-theme', savedTheme);
document.documentElement.setAttribute('data-accent', savedAccent);

createRoot(document.getElementById('root')!).render(
  <HashRouter>
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/new-project" element={<NewProjectPage />} />
        <Route path="/projects/:id" element={<ProjectDetailsPage />} />
        <Route path="/projects/:id/search" element={<SearchPage />} />
        <Route path="/articles/:id" element={<ArticleReaderPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/terms" element={<TermsOfUsePage />} />
      </Routes>
    </Layout>
  </HashRouter>
)
