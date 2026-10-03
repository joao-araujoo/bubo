/** Curated playful copy: no generated spoilers, threats, guilt or promises of instant memory. */
const OPENERS = [
  { title: 'Sua memória pediu um bis', body: 'O livro fechou. A ideia ainda pode brilhar.' },
  {
    title: 'Pausa para um piu de memória?',
    body: 'O Bubo trouxe um pequeno treino, sem prova surpresa.',
  },
  {
    title: 'Faxina nas teias da memória',
    body: 'Vamos dar uma espreguiçada nas ideias que você leu?',
  },
  {
    title: 'O clube das ideias vivas',
    body: 'Tem lembrança querendo sair da estante e conversar.',
  },
  {
    title: 'Piu! Uma visita às suas ideias',
    body: 'Seu próximo capítulo pode começar com uma boa lembrança.',
  },
  {
    title: 'A memória também gosta de reencontros',
    body: 'Um pouquinho de revisão cabe no seu ritmo.',
  },
] as const;

export function reviewReminderCopy(input: {
  userId: string;
  localDate: string;
  dueCount: number;
}): { title: string; body: string } {
  let seed = 0;
  for (const character of `${input.userId}:${input.localDate}`) {
    seed = (seed * 31 + character.charCodeAt(0)) >>> 0;
  }
  const copy = OPENERS[seed % OPENERS.length] ?? OPENERS[0];
  const count =
    input.dueCount === 1
      ? '1 lembrança para revisar.'
      : `${input.dueCount} lembranças para revisar.`;
  return { title: copy.title, body: `${copy.body} ${count}` };
}
