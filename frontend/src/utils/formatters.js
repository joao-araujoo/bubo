const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

export function formatRelativeTime(value) {
  if (!value) return 'agora';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recentemente';

  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(seconds);

  if (absoluteSeconds < 60) return rtf.format(seconds, 'second');
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(days, 'day');
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return rtf.format(months, 'month');
  return rtf.format(Math.round(months / 12), 'year');
}

export function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value) || 0);
}

export function getBookStatusLabel(status) {
  return {
    reading: 'Lendo',
    read: 'Lido',
    'to-read': 'Quero ler',
    abandoned: 'Abandonado',
  }[status] || 'Sem status';
}

export function getActivityLabel(type, postType) {
  if (type === 'review_approved') return 'Deep Review validada';
  if (type === 'achievement_unlocked') return 'Conquista desbloqueada';
  if (type === 'book_completed') return 'Leitura concluída';
  if (type === 'book_added') return 'Livro adicionado';
  if (type === 'post' && postType === 'review') return 'Insight de Deep Review';
  if (type === 'post' && postType === 'challenge') return 'Progresso em desafio';
  return 'Post livre';
}
