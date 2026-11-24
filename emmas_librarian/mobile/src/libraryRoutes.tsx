import React from 'react';
import { Route } from 'react-router-dom';
import { ArticleScreen } from './screens/ArticleScreen';
import { PdfScreen } from './screens/PdfScreen';
import { ProjectScreen } from './screens/ProjectScreen';
import { ProjectsScreen } from './screens/ProjectsScreen';

/**
 * The routes of the library screens, the same in every mode. `guard` wraps each screen (the modes that may have no
 * library open send the person back to the start); the default leaves it as it is.
 *
 * @example <Routes>{libraryRoutes()}</Routes>
 */
export function libraryRoutes(
  guard: (screen: React.ReactElement) => React.ReactElement = (screen) => screen,
): React.ReactElement[] {
  return [
    <Route key="projects" path="/projects" element={guard(<ProjectsScreen />)} />,
    <Route key="project" path="/projects/:projectId/:tab?" element={guard(<ProjectScreen />)} />,
    <Route key="article" path="/articles/:articleId" element={guard(<ArticleScreen />)} />,
    <Route key="pdf" path="/articles/:articleId/pdf" element={guard(<PdfScreen />)} />,
  ];
}
