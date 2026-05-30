// PrismJS is loaded externally via <script> tags in index.html
// to ensure correct initialization order in production builds.
// See public/vendor/prismjs/ and the error report in relatorio_erro_prism.md.

import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'

const DashboardPage = lazy(() => import('./pages/DashboardPage').then(module => ({ default: module.DashboardPage })))
const NewProjectPage = lazy(() => import('./pages/NewProjectPage').then(module => ({ default: module.NewProjectPage })))
const ProjectDetailsPage = lazy(() => import('./pages/ProjectDetailsPage').then(module => ({ default: module.ProjectDetailsPage })))
const SearchPage = lazy(() => import('./pages/SearchPage').then(module => ({ default: module.SearchPage })))
const ArticleReaderPage = lazy(() => import('./pages/ArticleReaderPage').then(module => ({ default: module.ArticleReaderPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(module => ({ default: module.SettingsPage })))
const TermsOfUsePage = lazy(() => import('./pages/TermsOfUsePage').then(module => ({ default: module.TermsOfUsePage })))
import './style.css'

// Initialize theme and accent
const savedTheme = localStorage.getItem('theme') || 'light';
const savedAccent = localStorage.getItem('accent') || 'blue';
document.documentElement.setAttribute('data-theme', savedTheme);
document.documentElement.setAttribute('data-accent', savedAccent);

if ((window as any).electronAPI) {
  (window as any).electronAPI.invoke('UPDATE_TITLE_BAR', savedTheme);
}

createRoot(document.getElementById('root')!).render(
  <HashRouter>
    <Layout>
      <Suspense fallback={<div className="flex-1 flex items-center justify-center p-8 text-gray-500">Loading...</div>}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/new-project" element={<NewProjectPage />} />
          <Route path="/projects/:id" element={<ProjectDetailsPage />} />
          <Route path="/projects/:id/search" element={<SearchPage />} />
          <Route path="/articles/:id" element={<ArticleReaderPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/terms" element={<TermsOfUsePage />} />
        </Routes>
      </Suspense>
    </Layout>
  </HashRouter>
);
