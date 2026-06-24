import { useState, useEffect } from 'react';
import { Article } from '../types';

export function useProjectMetrics(articles: Article[]) {
  const [metrics, setMetrics] = useState({
    total: 0,
    read: 0,
    new: 0,
    archived: 0,
    withPdf: 0,
  });

  useEffect(() => {
    setMetrics({
      total: articles.length,
      read: articles.filter((a) => a.status === 'read').length,
      new: articles.filter((a) => a.status === 'new').length,
      archived: articles.filter((a) => a.status === 'archived').length,
      withPdf: articles.filter((a) => !!a.local_file_path).length,
    });
  }, [articles]);

  return metrics;
}
