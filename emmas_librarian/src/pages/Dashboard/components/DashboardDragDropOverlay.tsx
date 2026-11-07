import React from 'react';
import { Download } from 'lucide-react';
import '../dashboard.css';

/**
 * The full-window hint while a project file is dragged over the dashboard.
 *
 * @example {isDragging && <DashboardDragDropOverlay />}
 */
export const DashboardDragDropOverlay: React.FC = () => (
  <div className="dashboard-drop-overlay">
    <Download size={64} className="bounce-subtle" />
    <h2>Solte o arquivo do projeto (.emmapcarc) aqui</h2>
    <p>O projeto será importado automaticamente para a sua biblioteca.</p>
  </div>
);
