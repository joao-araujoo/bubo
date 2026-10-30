import { API_PREFIX } from '@bubo/config';
import { API_ROUTES, apiPath } from '@bubo/contracts';
import { EMAIL_CODE_TTL_MINUTES, READING_RETURN_COOLDOWN_DAYS } from '@bubo/domain';

import { emailArt, type EmailArtName, emailPalette as p } from './email-artwork.generated';

export const AUTH_EMAIL_LINK_TTL_SECONDS = 60 * 60;
export type EmailReader = { to: string; name: string };
export type EmailLink = EmailReader & { url: string };
export type EmailCode = EmailReader & { code: string };
export type ReadingReturnEmail = EmailReader & {
  bookTitle: string;
  currentPage: number;
  totalPages: number | null;
  daysAway: number;
  /** Deep link to the book in the app. */
  bookUrl: string;
  /** Signed one-click opt-out link (ADR-038). */
  unsubscribeUrl: string;
};
/** No attachments (ADR-041): images are small hosted files referenced by absolute URL. */
export type EmailContent = {
  subject: string;
  text: string;
  html: string;
  /** Extra SMTP headers (List-Unsubscribe on optional e-mails). */
  headers?: Record<string, string>;
};

/** Turns an art name into the absolute URL an e-mail points at. */
export type EmailArtLinks = (name: EmailArtName) => string;

/**
 * Art served by the API itself at `<baseUrl>/v1/email/art/<name>.<hash>.png` (ADR-041). File
 * names carry a content hash, so mail-client image proxies can cache them forever.
 */
export function hostedEmailArt(baseUrl: string): EmailArtLinks {
  const base = baseUrl.replace(/\/+$/, '');
  return (name) =>
    `${base}${API_PREFIX}${apiPath(API_ROUTES.emailArt, { file: emailArt[name].file })}`;
}

/** Local development default, the same fallback as Better Auth's base URL. */
const LOCAL_ART = hostedEmailArt('http://localhost:8787');

type PoseOf<Name> = Name extends `hero-${infer Pose}` ? Pose : never;
type Pose = PoseOf<EmailArtName>;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** `**text**` becomes bold in HTML and plain text in the text part. Everything is escaped first. */
function inline(value: string): string {
  return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
function plain(value: string): string {
  return value.replaceAll('**', '');
}

function assertSafeUrl(value: string): string {
  const url = new URL(value);
  if (!['https:', 'http:', 'bubo:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Invalid email action URL.');
  }
  return value;
}

/**
 * One e-mail, calm and minimal (ADR-041, after the owner's reference): a white page, Bubo inside
 * soft concentric circles, the logo under it, then one short headline, a body of about forty
 * words and one clear action (or the code). Bubo carries the emotion through an official pose;
 * the copy is warm and never guilt-tripping.
 */
type Frame = {
  subject: string;
  preheader: string;
  eyebrow: string;
  title: string;
  name: string;
  paragraphs: string[];
  /** Big, spaced digits (login and password codes). */
  code?: string;
  /** One line of real numbers under the body ("Página 142 de 320"). */
  fact?: string;
  action?: { label: string; url: string };
  note: string;
  pose: Pose;
  /** Why the reader is receiving this e-mail; optional e-mails add an opt-out link. */
  footer: { reason: string; unsubscribeUrl?: string };
  art: EmailArtLinks;
};

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'SF Mono',Menlo,Consolas,'Courier New',monospace";
const TABLE = 'role="presentation" cellspacing="0" cellpadding="0" border="0"';

function frame(input: Frame): EmailContent {
  const firstName = input.name.trim().split(/\s+/)[0] ?? '';
  const greeting = firstName ? `Olá, ${firstName}!` : 'Olá!';
  const action = input.action ? { ...input.action, url: assertSafeUrl(input.action.url) } : null;
  const unsubscribeUrl = input.footer.unsubscribeUrl
    ? assertSafeUrl(input.footer.unsubscribeUrl)
    : null;
  const codeDigits = input.code ? input.code.replace(/\D/g, '') : null;
  const codeShown = codeDigits ? `${codeDigits.slice(0, 3)} ${codeDigits.slice(3)}`.trim() : null;
  const heroName = `hero-${input.pose}` as const;
  const hero = emailArt[heroName];
  const logo = emailArt.logo;

  const text = [
    greeting,
    '',
    plain(input.title),
    '',
    ...input.paragraphs.map(plain),
    ...(codeShown ? ['', `Seu código: ${codeShown}`] : []),
    ...(input.fact ? ['', plain(input.fact)] : []),
    ...(action ? ['', `${action.label}: ${action.url}`] : []),
    '',
    plain(input.note),
    '',
    'Bubo — Ler com calma. Lembrar por mais tempo.',
    plain(input.footer.reason),
    ...(unsubscribeUrl ? [`Não quero mais e-mails como este: ${unsubscribeUrl}`] : []),
  ].join('\n');

  const code = codeShown
    ? `<table ${TABLE} align="center" style="margin:24px auto 10px"><tr><td bgcolor="${p.purpleSoft}" style="background:${p.purpleSoft};border-radius:18px;padding:18px 30px"><span style="display:block;font-family:${MONO};font-size:36px;line-height:1.1;font-weight:700;letter-spacing:8px;white-space:nowrap;color:${p.purpleDeep}">${escapeHtml(codeShown)}</span></td></tr></table>
<p style="margin:0;font-size:13px;color:${p.inkMuted}">Vale por ${EMAIL_CODE_TTL_MINUTES} minutos</p>`
    : '';
  const button = action
    ? `<table ${TABLE} align="center" style="margin:28px auto 0"><tr><td align="center" bgcolor="${p.purple}" style="background:${p.purple};border-radius:999px"><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:15px 36px;font-size:16px;font-weight:700;line-height:1.2;color:${p.white};text-decoration:none;border-radius:999px">${escapeHtml(action.label)}</a></td></tr></table>`
    : '';
  const fallback = action
    ? `<br><br>Se o botão não abrir, copie este endereço:<br><a href="${escapeHtml(action.url)}" style="color:${p.purpleDeep};word-break:break-all">${escapeHtml(action.url)}</a>`
    : '';
  const optOut = unsubscribeUrl
    ? `<br><a href="${escapeHtml(unsubscribeUrl)}" style="color:${p.purpleDeep}">Não quero mais e-mails como este</a>`
    : '';

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(input.subject)}</title></head>
<body style="margin:0;padding:0;background:${p.white};color:${p.ink};font-family:${FONT};line-height:1.6;-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(input.preheader)}</div>
<table ${TABLE} width="100%" bgcolor="${p.white}" style="background:${p.white}"><tr><td align="center" style="padding:40px 20px 36px">
<table ${TABLE} width="100%" style="max-width:480px">
<tr><td align="center"><img src="${escapeHtml(input.art(heroName))}" width="${hero.width}" height="${hero.height}" alt="" style="display:block;width:${hero.width}px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none"></td></tr>
<tr><td align="center" style="padding:16px 0 36px"><img src="${escapeHtml(input.art('logo'))}" width="${logo.width}" height="${logo.height}" alt="Bubo" style="display:block;border:0;outline:none;text-decoration:none;color:${p.purpleDeep};font-size:22px;font-weight:800;letter-spacing:1px"></td></tr>
<tr><td align="center" style="padding:0 4px;text-align:center">
<p style="margin:0 0 12px;color:${p.purple};font-size:12px;font-weight:700;letter-spacing:2.5px">${escapeHtml(input.eyebrow)}</p>
<h1 style="margin:0 0 20px;font-size:28px;line-height:1.25;font-weight:800;letter-spacing:-0.4px;color:${p.ink}">${inline(input.title)}</h1>
<p style="margin:0 0 8px;font-size:16px;font-weight:700;color:${p.ink}">${escapeHtml(greeting)}</p>
${input.paragraphs.map((paragraph) => `<p style="margin:0 0 12px;font-size:16px;line-height:1.65;color:${p.inkMuted}">${inline(paragraph)}</p>`).join('\n')}
${code}
${input.fact ? `<p style="margin:4px 0 12px;font-size:15px;color:${p.purpleDeep}">${inline(input.fact)}</p>` : ''}
${button}
</td></tr>
<tr><td style="padding:36px 0 0"><table ${TABLE} width="100%"><tr><td style="border-top:1px solid ${p.line};padding:22px 8px 0;text-align:center;font-size:13px;line-height:1.6;color:${p.inkMuted}">${inline(input.note)}${fallback}</td></tr></table></td></tr>
<tr><td align="center" style="padding:28px 8px 0;font-size:12px;line-height:1.6;color:${p.inkMuted}">Ler com calma. Lembrar por mais tempo.<br>${inline(input.footer.reason)}${optOut}</td></tr>
</table>
</td></tr></table></body></html>`;

  return {
    subject: input.subject,
    text,
    html,
    ...(unsubscribeUrl
      ? {
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        }
      : {}),
  };
}

/* ----------------------------- Account and security ----------------------------- */

/** Second step of sign-in on an untrusted device (Better Auth two-factor, OTP by e-mail). */
export function loginCodeContent(message: EmailCode, art: EmailArtLinks = LOCAL_ART): EmailContent {
  return frame({
    ...message,
    art,
    subject: `${message.code} é o seu código de entrada no Bubo`,
    preheader: `Vale por ${EMAIL_CODE_TTL_MINUTES} minutos. Se não foi você, pode ignorar.`,
    eyebrow: 'CÓDIGO DE ENTRADA',
    title: 'Só falta um passo.',
    pose: 'confident',
    paragraphs: ['Digite este código no app para entrar na sua conta:'],
    code: message.code,
    note: `O código vale por ${EMAIL_CODE_TTL_MINUTES} minutos e só funciona uma vez. O Bubo nunca pede seu código por mensagem ou telefone. Se não foi você quem tentou entrar, ignore este e-mail: sua senha continua a mesma.`,
    footer: {
      reason: 'Você recebeu este e-mail porque alguém usou sua senha para entrar no Bubo.',
    },
  });
}

/** Password reset typed in the app (no deep link needed). */
export function passwordResetCodeContent(
  message: EmailCode,
  art: EmailArtLinks = LOCAL_ART,
): EmailContent {
  return frame({
    ...message,
    art,
    subject: `${message.code} é o seu código para criar uma nova senha`,
    preheader: 'Esquecer acontece. Digite o código no app e escolha uma senha nova.',
    eyebrow: 'NOVA SENHA',
    title: 'Vamos reencontrar sua estante?',
    pose: 'doubt',
    paragraphs: [
      'Esquecer acontece. Com senhas também.',
      'Digite o código abaixo no app e escolha uma senha nova:',
    ],
    code: message.code,
    note: `O código vale por ${EMAIL_CODE_TTL_MINUTES} minutos e só funciona uma vez. Se você não pediu uma nova senha, ignore este e-mail: nada muda na sua conta.`,
    footer: {
      reason:
        'Você recebeu este e-mail porque alguém pediu uma nova senha para esta conta no Bubo.',
    },
  });
}

/** Link-based reset kept for older app versions (one hour, single use). */
export function passwordResetContent(
  message: EmailLink,
  art: EmailArtLinks = LOCAL_ART,
): EmailContent {
  return frame({
    ...message,
    art,
    subject: 'Redefina sua senha do Bubo',
    preheader: 'Um novo começo para voltar à sua estante. O link vale por 1 hora.',
    eyebrow: 'VAMOS TE AJUDAR',
    title: 'Vamos reencontrar sua estante?',
    pose: 'doubt',
    paragraphs: [
      'Esquecer acontece. Com senhas também.',
      'Recebemos um pedido para redefinir a senha da sua conta. Crie uma nova e volte para os seus livros.',
    ],
    action: { label: 'Criar nova senha', url: message.url },
    note: 'O link vale por 1 hora e só pode ser usado uma vez. Se não foi você, ignore este e-mail: sua senha continua a mesma.',
    footer: {
      reason:
        'Você recebeu este e-mail porque alguém pediu uma nova senha para esta conta no Bubo.',
    },
  });
}

export function verificationContent(
  message: EmailLink,
  art: EmailArtLinks = LOCAL_ART,
): EmailContent {
  return frame({
    ...message,
    art,
    subject: '💜 Tem um lugar para você no Bubo',
    preheader: 'Sua estante ganhou companhia. Confirme seu e-mail para cuidar da sua conta.',
    eyebrow: 'SEU PRÓXIMO CAPÍTULO',
    title: 'Tem um lugar para você aqui.',
    pose: 'welcome',
    paragraphs: [
      'O Bubo vai acompanhar suas leituras e guardar o que você quer lembrar. Sem pressa, sem culpa.',
      'Vamos começar cuidando da sua conta? Confirme que este e-mail é seu.',
    ],
    action: { label: 'Confirmar meu e-mail', url: message.url },
    note: 'O link vale por 1 hora. Você já pode usar o app enquanto isso. Se não criou uma conta no Bubo, ignore este e-mail.',
    footer: {
      reason: 'Você recebeu este e-mail porque uma conta foi criada no Bubo com este endereço.',
    },
  });
}

export function passwordChangedContent(
  message: EmailReader,
  art: EmailArtLinks = LOCAL_ART,
): EmailContent {
  return frame({
    ...message,
    art,
    subject: 'Sua senha do Bubo foi alterada',
    preheader: 'A mudança foi concluída. Entre novamente com sua nova senha.',
    eyebrow: 'CONTA BEM CUIDADA',
    title: 'Senha nova. Livros de sempre.',
    pose: 'confident',
    paragraphs: [
      'A senha da sua conta foi alterada agora há pouco. Por segurança, os outros aparelhos foram desconectados: é só entrar de novo com a nova senha.',
      'Se foi você, está tudo certo. Seus livros continuam esperando.',
    ],
    action: { label: 'Entrar no Bubo', url: 'bubo:///entrar' },
    note: 'Não reconhece esta mudança? Abra o Bubo → Entrar → Esqueci minha senha e crie outra senha imediatamente. Proteja também o acesso ao seu e-mail.',
    footer: { reason: 'Você recebeu este e-mail porque a senha desta conta foi alterada.' },
  });
}

export function accountDeletedContent(
  message: EmailReader,
  art: EmailArtLinks = LOCAL_ART,
): EmailContent {
  return frame({
    ...message,
    art,
    subject: 'Sua conta no Bubo foi excluída',
    preheader: 'Seus dados foram apagados. Obrigado por ler com a gente.',
    eyebrow: 'ATÉ LOGO',
    title: 'Obrigado por ler com a gente.',
    pose: 'neutral',
    paragraphs: [
      'Sua conta, sua estante, suas sessões e suas reflexões foram apagadas, como você pediu. Nada disso pode ser recuperado.',
      'Se um dia quiser voltar, a porta fica aberta: é só criar uma conta nova.',
    ],
    note: 'Esta exclusão foi confirmada no app com a senha da conta. Se não foi você, saiba que os dados já não existem e que este endereço pode criar uma conta nova a qualquer momento.',
    footer: { reason: 'Você recebeu este e-mail porque a conta com este endereço foi excluída.' },
  });
}

/* ------------------------------- Optional (consent) ------------------------------- */

/** "Sentimos sua falta": after a week without reading, at most once a month, opt-out in one tap. */
export function readingReturnContent(
  message: ReadingReturnEmail,
  art: EmailArtLinks = LOCAL_ART,
): EmailContent {
  const page = Math.max(0, Math.floor(message.currentPage));
  const total =
    message.totalPages && message.totalPages > 0 ? Math.floor(message.totalPages) : null;
  const percent = total ? Math.min(100, Math.round((page / total) * 100)) : null;
  return frame({
    ...message,
    art,
    subject: '💜 Seu livro guardou a página',
    preheader: `"${message.bookTitle}" continua esperando${page > 0 ? ` na página ${page}` : ''}. Cinco minutos bastam para voltar.`,
    eyebrow: 'SENTIMOS SUA FALTA',
    title: page > 0 ? `A página ${page} ficou esperando.` : 'Seu livro ficou esperando.',
    pose: 'curious',
    paragraphs: [
      `Faz **${message.daysAway} dias** que o Bubo não te vê por aqui. Tudo bem: a vida acontece, e o seu lugar em **${message.bookTitle}** continua exatamente onde você parou.`,
      'Cinco minutos já contam. Que tal uma página hoje?',
    ],
    ...(total && page > 0
      ? { fact: `Página **${page}** de ${total} · ${percent}% lido` }
      : total
        ? { fact: `${total} páginas esperando por você` }
        : {}),
    action: { label: 'Voltar ao livro', url: message.bookUrl },
    note: `Este lembrete chega no máximo uma vez a cada ${READING_RETURN_COOLDOWN_DAYS} dias, e só quando você passa uma semana sem ler. Para parar, use o link no fim deste e-mail ou desligue "Lembretes de leitura" em Configurações → E-mails do Bubo.`,
    footer: {
      reason:
        'Você recebeu este e-mail porque os lembretes de leitura por e-mail estão ativos na sua conta do Bubo.',
      unsubscribeUrl: message.unsubscribeUrl,
    },
  });
}

export function testEmailContent(
  message: EmailReader,
  art: EmailArtLinks = LOCAL_ART,
): EmailContent {
  return frame({
    ...message,
    art,
    subject: 'O Bubo chegou ao seu e-mail',
    preheader: 'Um teste de entrega, com uma dose de carinho e a coruja oficial.',
    eyebrow: 'UM OLÁ DO BUBO',
    title: 'Olha quem pousou por aqui.',
    pose: 'welcome',
    paragraphs: [
      'Este é o e-mail de teste que você pediu. Se ele chegou, o caminho entre o Bubo, o Resend e o seu provedor foi percorrido.',
      'Por aqui, os recados são curtos, a estante é sua e cada leitura tem o seu tempo.',
    ],
    action: { label: 'Abrir o Bubo', url: 'bubo:///' },
    note: 'Este envio não criou uma conta nem alterou sua senha. O remetente de teste do Resend serve apenas para validar a entrega ao dono da conta.',
    footer: { reason: 'Você recebeu este e-mail porque pediu um teste de entrega.' },
  });
}
