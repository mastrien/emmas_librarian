export const getArticleStatusColor = (status?: string): string => {
  switch (status) {
    case 'read':
      return '#10b981';
    case 'archived':
      return '#6b7280';
    case 'new':
      return '#3b82f6';
    default:
      return '#6b7280';
  }
};

export const getArticleStatusLabel = (status?: string): string => {
  switch (status) {
    case 'read':
      return 'Lido';
    case 'archived':
      return 'Arquivado';
    case 'new':
      return 'Novo';
    default:
      return 'Desconhecido';
  }
};

export const formatDate = (dateString?: string): string => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) {
    return dateString;
  }
  return d.toLocaleDateString('pt-BR');
};

/**
 * Last segment of a Windows or POSIX path, for showing attached files by name.
 *
 * Usage:
 *   fileNameFromPath('C:\\docs\\edital.pdf'); // 'edital.pdf'
 */
export const fileNameFromPath = (path: string): string => path.split(/[\\/]/).pop() ?? path;

/**
 * A file size for people: bytes, KB, MB or GB, with up to two decimals.
 *
 * @example formatBytes(1536) // '1.5 KB'
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}
