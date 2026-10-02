import { emailArtwork, emailPalette as p } from './email-artwork.generated';

export const AUTH_EMAIL_LINK_TTL_SECONDS = 60 * 60;
export type EmailReader = { to: string; name: string };
export type EmailLink = EmailReader & { url: string };
export type EmailAttachment = {
  filename: string;
  content: string;
  content_type: 'image/png';
  content_id: string;
};
export type EmailContent = {
  subject: string;
  text: string;
  html: string;
  attachments: EmailAttachment[];
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

type Frame = {
  subject: string;
  preheader: string;
  eyebrow: string;
  title: string;
  name: string;
  paragraphs: string[];
  action: { label: string; url: string };
  note: string;
  pose: 'welcome' | 'doubt' | 'confident';
};

function frame(input: Frame): EmailContent {
  const firstName = input.name.trim().split(/\s+/)[0] ?? '';
  const greeting = firstName ? `Olá, ${firstName}!` : 'Olá!';
  const url = new URL(input.action.url);
  if (!['https:', 'http:', 'bubo:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Invalid email action URL.');
  }
  const text = [
    greeting,
    '',
    input.title,
    '',
    ...input.paragraphs,
    '',
    `${input.action.label}: ${input.action.url}`,
    '',
    input.note,
    '',
    'Bubo — Ler com calma. Lembrar por mais tempo.',
  ].join('\n');
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.subject)}</title></head>
<body style="margin:0;padding:0;background:${p.lavender};color:${p.ink};font-family:Arial,Helvetica,sans-serif;line-height:1.6">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${p.lavender}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px"><tr><td align="center" style="padding:0 0 24px"><img src="cid:bubo-logo" width="144" height="46" alt="Bubo — Read deeply." style="display:block;border:0"></td></tr>
<tr><td style="background:${p.white};border:1px solid ${p.line};border-radius:24px;padding:32px 24px;text-align:center">
<img src="cid:bubo-mascot" width="176" alt="Bubo te acompanha" style="display:block;margin:0 auto 20px;border:0;max-width:100%;height:auto">
<p style="margin:0 0 10px;color:${p.purpleDeep};font-size:12px;font-weight:700;letter-spacing:1.5px">${escapeHtml(input.eyebrow)}</p>
<h1 style="margin:0 0 20px;font-size:30px;line-height:1.2;color:${p.ink}">${escapeHtml(input.title)}</h1>
<p style="margin:0 0 12px;font-weight:700;font-size:17px">${escapeHtml(greeting)}</p>
${input.paragraphs.map((paragraph) => `<p style="margin:0 0 16px;font-size:16px">${escapeHtml(paragraph)}</p>`).join('\n')}
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px auto"><tr><td bgcolor="${p.purple}" style="border-radius:16px;border-bottom:4px solid ${p.purpleDeep}"><a href="${escapeHtml(input.action.url)}" style="display:inline-block;padding:14px 26px;min-height:20px;color:${p.white};font-size:16px;font-weight:700;text-decoration:none;border-radius:16px">${escapeHtml(input.action.label)}</a></td></tr></table>
<p style="margin:20px 0 0;padding:16px;background:${p.lavender};border-radius:16px;font-size:13px;color:${p.inkMuted}">${escapeHtml(input.note)}</p>
<p style="margin:20px 0 0;font-size:12px;color:${p.inkMuted}">Se o botão não abrir, copie este endereço:<br><a href="${escapeHtml(input.action.url)}" style="color:${p.purpleDeep};word-break:break-all">${escapeHtml(input.action.url)}</a></p>
</td></tr><tr><td align="center" style="padding:24px 12px;color:${p.inkMuted};font-size:12px">Ler com calma. Lembrar por mais tempo.<br>Com carinho, Bubo.</td></tr></table>
</td></tr></table></body></html>`;
  return {
    subject: input.subject,
    text,
    html,
    attachments: [
      {
        filename: 'bubo-logo.png',
        content: emailArtwork.logo,
        content_type: 'image/png',
        content_id: 'bubo-logo',
      },
      {
        filename: `bubo-${input.pose}.png`,
        content: emailArtwork[input.pose],
        content_type: 'image/png',
        content_id: 'bubo-mascot',
      },
    ],
  };
}

export function passwordResetContent(message: EmailLink): EmailContent {
  return frame({
    ...message,
    subject: 'Redefina sua senha do Bubo',
    preheader: 'Um novo começo para voltar à sua estante. O link vale por 1 hora.',
    eyebrow: 'VAMOS TE AJUDAR',
    title: 'Vamos reencontrar sua estante?',
    pose: 'doubt',
    paragraphs: [
      'Esquecer acontece. Com senhas também.',
      'Recebemos um pedido para redefinir a senha da sua conta no Bubo. Crie uma nova e volte para os seus livros.',
    ],
    action: { label: 'Criar nova senha', url: message.url },
    note: 'O link vale por 1 hora e só pode ser usado uma vez. Se não foi você, ignore este email: sua senha continua a mesma.',
  });
}

export function verificationContent(message: EmailLink): EmailContent {
  return frame({
    ...message,
    subject: 'Boas-vindas ao Bubo — confirme seu email',
    preheader: 'Sua estante ganhou uma companhia. Confirme seu email para cuidar da sua conta.',
    eyebrow: 'SEU PRÓXIMO CAPÍTULO',
    title: 'Tem um lugar para você aqui.',
    pose: 'welcome',
    paragraphs: [
      'O Bubo chegou para acompanhar suas leituras, suas descobertas e aquilo que você quer guardar na memória.',
      'Vamos começar cuidando da sua conta? Confirme que este email é seu.',
    ],
    action: { label: 'Confirmar meu email', url: message.url },
    note: 'O link vale por 1 hora. Você já pode usar o app enquanto isso. Se não criou uma conta no Bubo, ignore este email.',
  });
}

export function passwordChangedContent(message: EmailReader): EmailContent {
  return frame({
    ...message,
    subject: 'Sua senha do Bubo foi alterada',
    preheader: 'A mudança foi concluída. Entre novamente com sua nova senha.',
    eyebrow: 'CONTA BEM CUIDADA',
    title: 'Senha nova. Livros de sempre.',
    pose: 'confident',
    paragraphs: [
      'A senha da sua conta foi redefinida. Para continuar cuidando da sua estante, entre novamente com sua nova senha.',
      'Se foi você, está tudo certo. Seus livros e suas leituras continuam esperando por você.',
    ],
    action: { label: 'Entrar no Bubo', url: 'bubo:///entrar' },
    note: 'Não reconhece esta mudança? Abra o Bubo → Entrar → Esqueci minha senha e redefina a senha imediatamente. Proteja também o acesso ao seu email.',
  });
}

export function testEmailContent(message: EmailReader): EmailContent {
  return frame({
    ...message,
    subject: 'O Bubo chegou ao seu email',
    preheader: 'Um teste de entrega, com uma dose de carinho e a coruja oficial.',
    eyebrow: 'UM OLÁ DO BUBO',
    title: 'Olha quem pousou por aqui.',
    pose: 'welcome',
    paragraphs: [
      'Este é o email de teste que você pediu. Se ele chegou, o caminho entre o Bubo, o Resend e o seu provedor de email foi percorrido.',
      'Por aqui, os recados são curtos, a estante é sua e cada leitura tem o seu tempo.',
    ],
    action: { label: 'Abrir o Bubo', url: 'bubo:///' },
    note: 'Este envio não criou uma conta nem alterou sua senha. O remetente de teste do Resend serve apenas para validar a entrega ao dono da conta.',
  });
}
