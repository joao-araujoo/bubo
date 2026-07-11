const FOCUS_LEVELS = new Set(['not-informed', 'low', 'medium', 'high']);
const MAX_NOTE_LENGTH = 2000;
const MAX_DURATION_MINUTES = 1440;

const parseInteger = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
};

const createValidationError = (message, code) => {
  const error = new Error(message);
  error.code = code;
  error.status = 400;
  return error;
};

const normalizeReadingSessionInput = (payload = {}, context = {}) => {
  const currentPage = Math.max(0, Number(context.currentPage) || 0);
  const totalPages = Math.max(0, Number(context.totalPages) || 0);
  const pageFrom = parseInteger(payload.pageFrom) ?? currentPage + 1;
  const pageTo = parseInteger(payload.pageTo);
  const durationMinutes = parseInteger(payload.durationMinutes) ?? 0;
  const focus = FOCUS_LEVELS.has(payload.focus) ? payload.focus : 'not-informed';
  const note = String(payload.note || '').trim();
  const readAt = payload.readAt ? new Date(payload.readAt) : new Date();

  if (!Number.isInteger(pageFrom) || pageFrom < 1) {
    throw createValidationError('A página inicial precisa ser um número maior que zero.', 'READING_SESSION_PAGE_FROM_INVALID');
  }
  if (!Number.isInteger(pageTo) || pageTo < pageFrom) {
    throw createValidationError('A página final precisa ser igual ou maior que a página inicial.', 'READING_SESSION_PAGE_TO_INVALID');
  }
  if (totalPages > 0 && pageTo > totalPages) {
    throw createValidationError(`A página final não pode ultrapassar ${totalPages}.`, 'READING_SESSION_TOTAL_EXCEEDED');
  }
  if (durationMinutes < 0 || durationMinutes > MAX_DURATION_MINUTES) {
    throw createValidationError('A duração deve ficar entre 0 e 1440 minutos.', 'READING_SESSION_DURATION_INVALID');
  }
  if (note.length > MAX_NOTE_LENGTH) {
    throw createValidationError(`A observação deve ter no máximo ${MAX_NOTE_LENGTH} caracteres.`, 'READING_SESSION_NOTE_TOO_LONG');
  }
  if (Number.isNaN(readAt.getTime())) {
    throw createValidationError('A data da sessão é inválida.', 'READING_SESSION_DATE_INVALID');
  }
  if (readAt.getTime() > Date.now() + 5 * 60 * 1000) {
    throw createValidationError('A sessão não pode estar no futuro.', 'READING_SESSION_DATE_IN_FUTURE');
  }

  return {
    pageFrom,
    pageTo,
    pagesRead: pageTo - pageFrom + 1,
    durationMinutes,
    focus,
    note,
    readAt,
  };
};

module.exports = {
  FOCUS_LEVELS,
  MAX_DURATION_MINUTES,
  MAX_NOTE_LENGTH,
  normalizeReadingSessionInput,
};
