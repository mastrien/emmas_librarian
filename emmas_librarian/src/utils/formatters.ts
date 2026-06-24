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
  try {
    return new Date(dateString).toLocaleDateString('pt-BR');
  } catch (e) {
    return dateString;
  }
};
