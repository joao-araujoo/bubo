// Local examples only. No credentials are read and no email is sent.
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import {
  passwordResetContent,
  verificationContent,
  passwordChangedContent,
  testEmailContent,
} from '../apps/api/src/services/email-templates';

const output = path.resolve('build/emails');
fs.mkdirSync(output, { recursive: true });
const reader = { to: 'preview@example.test', name: 'Leitora' };
const examples = {
  'boas-vindas': verificationContent({ ...reader, url: 'https://example.test/confirmar-email' }),
  'recuperar-senha': passwordResetContent({ ...reader, url: 'https://example.test/nova-senha' }),
  'senha-alterada': passwordChangedContent(reader),
  'teste-entrega': testEmailContent(reader),
};
for (const [name, content] of Object.entries(examples)) {
  let html = content.html;
  for (const attachment of content.attachments) {
    html = html.replaceAll(
      `cid:${attachment.content_id}`,
      `data:image/png;base64,${attachment.content}`,
    );
  }
  fs.writeFileSync(path.join(output, `${name}.html`), html);
  fs.writeFileSync(path.join(output, `${name}.txt`), content.text);
}
fs.writeFileSync(
  path.join(output, 'index.html'),
  `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Emails do Bubo</title></head><body style="font-family:Arial,sans-serif;margin:24px"><h1>Emails do Bubo</h1><p>Prévias locais. Links de exemplo; nenhum envio.</p>${Object.keys(
    examples,
  )
    .map((name) => `<p><a href="${name}.html">${name}</a></p>`)
    .join('')}</body></html>`,
);
console.log(`Prévias prontas: ${path.join(output, 'index.html')}`);
if (process.argv.includes('--serve')) {
  const allowed = new Set(['index.html', ...Object.keys(examples).map((name) => `${name}.html`)]);
  createServer((request, response) => {
    const name = new URL(request.url ?? '/', 'http://localhost').pathname.slice(1) || 'index.html';
    if (!allowed.has(name)) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(fs.readFileSync(path.join(output, name)));
  }).listen(8669, '127.0.0.1', () => console.log('Prévias: http://127.0.0.1:8669'));
}
