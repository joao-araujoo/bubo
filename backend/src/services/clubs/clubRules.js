const createRuleError = (message, code) => {
  const error = new Error(message);
  error.code = code;
  error.status = 400;
  return error;
};

const optionalPage = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
};

const normalizeClubProgress = (value, totalPages = 0) => {
  const page = Number.parseInt(value, 10);
  if (!Number.isInteger(page) || page < 0) {
    throw createRuleError('A página atual precisa ser um número inteiro igual ou maior que zero.', 'CLUB_PROGRESS_INVALID');
  }
  const total = Math.max(0, Number(totalPages) || 0);
  return total > 0 ? Math.min(page, total) : page;
};

const normalizeDiscussionPages = ({ pageFrom, pageTo } = {}, totalPages = 0) => {
  const from = optionalPage(pageFrom);
  const to = optionalPage(pageTo);
  const hasFrom = from !== undefined;
  const hasTo = to !== undefined;

  if (hasFrom !== hasTo) {
    throw createRuleError('Informe a página inicial e a página final, ou deixe as duas em branco.', 'CLUB_DISCUSSION_PAGE_PAIR_REQUIRED');
  }
  if (!hasFrom && !hasTo) return { pageFrom: undefined, pageTo: undefined };
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < 1) {
    throw createRuleError('As páginas da discussão precisam ser números inteiros maiores que zero.', 'CLUB_DISCUSSION_PAGE_INVALID');
  }
  if (to < from) {
    throw createRuleError('A página final precisa ser igual ou maior que a página inicial.', 'CLUB_DISCUSSION_PAGE_ORDER_INVALID');
  }

  const total = Math.max(0, Number(totalPages) || 0);
  if (total > 0 && (from > total || to > total)) {
    throw createRuleError(`As páginas da discussão não podem ultrapassar ${total}.`, 'CLUB_DISCUSSION_TOTAL_EXCEEDED');
  }

  return { pageFrom: from, pageTo: to };
};

module.exports = {
  normalizeClubProgress,
  normalizeDiscussionPages,
};
