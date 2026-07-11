export const validateClubDiscussion = (discussion, totalPages = 0) => {
  const body = String(discussion?.body || '').trim();
  if (!body) return 'Escreva uma contribuição antes de publicar.';

  const rawFrom = discussion?.pageFrom;
  const rawTo = discussion?.pageTo;
  const hasFrom = rawFrom !== '' && rawFrom !== undefined && rawFrom !== null;
  const hasTo = rawTo !== '' && rawTo !== undefined && rawTo !== null;

  if (hasFrom !== hasTo) {
    return 'Informe a página inicial e a página final, ou deixe as duas em branco.';
  }
  if (!hasFrom && !hasTo) return null;

  const from = Number.parseInt(rawFrom, 10);
  const to = Number.parseInt(rawTo, 10);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < 1) {
    return 'As páginas precisam ser números inteiros maiores que zero.';
  }
  if (to < from) return 'A página final precisa ser igual ou maior que a página inicial.';

  const total = Math.max(0, Number(totalPages) || 0);
  if (total > 0 && (from > total || to > total)) {
    return `As páginas da discussão não podem ultrapassar ${total}.`;
  }
  return null;
};
