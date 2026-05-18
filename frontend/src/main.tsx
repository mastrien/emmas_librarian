import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { NewProjectPage } from './pages/NewProjectPage'
import './style.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<NewProjectPage />} />
        <Route path="/new-project" element={<NewProjectPage />} />
        {/* We will add ProjectDetailsPage here later */}
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
