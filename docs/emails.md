# Emails do Bubo

## O que inspirou (estudo, 2026-10-12)

As referências do dono foram emails do Duolingo: logo pequeno no topo, mascote grande, uma manchete
só, texto de poucas palavras (um deles tem 34), um botão, tudo visível sem rolar no celular, e um
assunto que diz exatamente o que aconteceu. Guardamos disso a estrutura e a concisão; deixamos de
fora a culpa ("você deixou o Duo triste"): o Bubo é acolhedor, a vida acontece e voltar é fácil.

## Moldura (ADR-041, antes ADR-038)

Uma moldura só para todos os emails, branca e minimalista, na linha da tela de carregamento de
referência do dono (mascote em círculos concêntricos suaves, logo embaixo, quase nenhum texto). Em
tabelas com CSS inline, coluna única de 480 px, sem anexos, sem tracking e sem dependência nova:

1. o Bubo (pose oficial escolhida pela emoção do momento, 220 px) dentro de três círculos
   concêntricos em lilás translúcido;
2. logo horizontal pequeno (120 px) logo abaixo;
3. eyebrow roxo em caixa alta, manchete de 28 px, saudação com o primeiro nome;
4. um ou dois parágrafos curtos em cinza, com no máximo um fato em negrito;
5. **ou** um código grande (`482 913`, monoespaçado, fundo `purpleSoft`, "vale por 10 minutos")
   **ou** um botão roxo em pílula;
6. nota curta abaixo de uma linha fina (validade, o que fazer se não foi você);
7. rodapé: assinatura, por que você recebeu este email e, nos opcionais, "Não quero mais".

Códigos aparecem no assunto e no corpo, nunca em botão; a versão texto tem o mesmo conteúdo.

**Imagens hospedadas (ADR-041).** Nada vai anexado: as imagens são arquivos pequenos servidos pela
própria API em `GET /v1/email/art/<nome>.<hash>.png` (público, sem sessão e sem banco, cache de um
ano, `immutable`). Os emails apontam para `<BETTER_AUTH_URL>/v1/email/art/…`. `email:assets`
gera, a partir dos PNGs oficiais (recortados e reduzidos, nunca redesenhados), 5 heróis de
440 × 440 px (~23–25 KB cada, paleta de até 256 cores) e o logo de 240 px (~6 KB): cada email
referencia ~30 KB, contra ~420 KB de anexos antes. Clientes que bloqueiam imagens mostram o mesmo
layout sem elas; o logo vira o texto "Bubo".

## Modelos implementados

| Email                          | Gatilho                                                  | Manchete / ação                                       | Pose      | Opt-out |
| ------------------------------ | -------------------------------------------------------- | ----------------------------------------------------- | --------- | ------- |
| Código de entrada              | Senha certa em aparelho não lembrado (`two-factor`)      | "Só falta um passo." → código de 6 dígitos            | confident | não     |
| Código para nova senha         | "Esqueci minha senha" no app (`email-otp`)               | "Vamos reencontrar sua estante?" → código             | doubt     | não     |
| Link para nova senha           | Versões antigas do app (`request-password-reset`)        | "Vamos reencontrar sua estante?" → Criar nova senha   | doubt     | não     |
| Boas-vindas + confirmar e-mail | Um envio no cadastro, quando há provedor                 | "Tem um lugar para você aqui." → Confirmar meu e-mail | welcome   | não     |
| Senha alterada                 | Nova senha por código, por link ou em Conta e segurança  | "Senha nova. Livros de sempre." → Entrar no Bubo      | confident | não     |
| Conta excluída                 | Exclusão confirmada com a senha                          | "Obrigado por ler com a gente."                       | neutral   | não     |
| Sentimos sua falta             | Cron horário, 10h locais, 7+ dias sem ler, 1 a cada 30 d | "A página 142 ficou esperando." → Voltar ao livro     | curious   | sim     |
| Teste de entrega               | `npm run email:check -- --send-to`                       | "Olha quem pousou por aqui." → Abrir o Bubo           | welcome   | não     |

Regras de segurança dos códigos: 6 dígitos, guardados como hash, 10 minutos, uso único, 5
tentativas por código, 3 envios/min e 10 verificações/min por IP (login), 3 pedidos/min (nova
senha). Logs registram categoria, id do provedor e status; nunca código, destinatário, corpo ou
link. Sem provedor configurado, o login não pede código e os pedidos de código respondem 503.
Chave de idempotência do Resend: hash do evento (códigos usam um id aleatório por envio).

## Programa de e-mails: consentimento e opcionais

- **Da conta** (sempre enviados): códigos, nova senha, senha alterada, boas-vindas, exclusão.
- **Opcionais** (consentimento em Você → Configurações → E-mails do Bubo; `email_reading_reminders`,
  padrão ligado): cada envio leva um link assinado de descadastro em um toque
  (`/v1/email/unsubscribe?token=`, cabeçalhos `List-Unsubscribe` e `List-Unsubscribe-Post`) e é
  registrado em `reader_email_events` (só id e tipo).
- **Sentimos sua falta** (implementado): leitor com consentimento, livro "Lendo", pelo menos uma
  sessão aceita, 7+ dias sem ler, sem este email nos últimos 30 dias, às 10h do fuso dele. Regras
  puras em `@bubo/domain/email-program.ts`, checadas no SQL e de novo antes de enviar; a reserva é
  gravada antes do envio e liberada se o provedor falhar; chave de idempotência = leitor + dia local.
  O texto mostra o livro, a página real e os dias fora, e abre o livro no app.

### Propostos, não enviados

| Caso                 | Elegibilidade e limite propostos                                                      | Dependências                                             |
| -------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Resumo semanal       | Opt-in próprio + leitura real na semana; segunda 9h local; máximo 1/semana            | Agregar sessões/revisões da semana; nova chave de opt-in |
| Sequência em risco   | Opt-in + sequência ≥ 3 dias, sem leitura hoje, 20h local; máximo 1/dia; preferir push | Evitar duplicar o lembrete de revisão; aceite do dono    |
| Novo aparelho entrou | Após código aceito em aparelho não lembrado; sem opt-out (segurança)                  | Gancho após `verify-otp`; copy sem alarmar               |
| Revisão disponível   | Opt-in + revisão realmente oferecida; preferir inbox/push; máximo 1 email/dia         | Não consumir cota à toa                                  |
| Convite de clube     | Ação explícita e destinatário autorizado; um envio por convite, sem spoilers          | Tratar abuso/bloqueios; compartilhamento já existe       |

O [plano gratuito](https://resend.com/pricing) permite 3.000 emails/mês e 100/dia. Os emails da
conta têm prioridade; nenhum opcional novo entra sem opt-out, supressão de bounces e dados reais.

## Evidência e ativação

Em 2026-10-01, a chave do `.env` autenticou no Resend. O teste com os modelos recebeu
`last_event: delivered` e foi encontrado em **INBOX** no Gmail do dono, com logo e welcome inline.
Usou `onboarding@resend.dev`, que [só envia ao dono da conta](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).
O dono informou em 2026-10-12 que a chave do Resend já está configurada e funcionando. Os
modelos novos (códigos, exclusão, sentimos sua falta) e a moldura redesenhada foram validados por
testes e prévias locais; a chegada real na caixa de entrada e a leitura em Gmail/Outlook/Apple
Mail ainda estão no roteiro de aceite.

`bubo.nyoneo.com.br` foi preparado no Resend, com tracking desligado e recebimento desativado.
Passos e valores exatos: [emails-dns.md](emails-dns.md). O `.env` não configura sozinho a API
publicada ou `apps/api/.dev.vars`.

**2026-10-12:** migração `0017` aplicada no Neon. Os oito modelos foram enviados ao Gmail do dono
pelo remetente de teste (`npm run email:samples -- --send-to … --test-sender`): todos aceitos pelo
Resend, último evento `sent`. Na mesma tarde o dono adicionou os quatro registros na Hostinger;
`npm run email:activate` confirmou o domínio `verified` no Resend, gravou os secrets no Worker e
atualizou `.dev.vars`. A API foi publicada e o smoke em produção, com conta temporária apagada ao
fim, enviou pelo remetente real boas-vindas, código de entrada, código de nova senha e exclusão.
Falta só o aceite visual no Gmail/Outlook/Apple Mail e no aparelho.

## Comandos

```powershell
npm run email:preview
npm run email:check
npm run email:samples -- --send-to voce@example.com --test-sender --name SeuNome
npm run email:activate -- --check
npm run email:activate
```

`email:samples` envia um exemplo de cada modelo ao destinatário explícito (sem `--send-to`,
nada é enviado). `email:activate` pede a verificação do domínio ao Resend, espera até dois
minutos, grava `RESEND_API_KEY` e `EMAIL_FROM` como secrets do Worker de produção (valores via
stdin, nunca impressos) e copia as duas linhas para `apps/api/.dev.vars`; com `--check` só mostra o
estado dos registros. Ele se recusa a configurar um remetente não verificado. Depois, publique com
`npm run deploy:api`.

Prévias: `build/emails/index.html` (boas-vindas, código de entrada, código de nova senha, link de
nova senha, senha alterada, sentimos sua falta, conta excluída, teste). Não leem credenciais nem
enviam. `npm run email:preview -- --serve` serve em `http://127.0.0.1:8669`.
O diagnóstico é read-only: lê `.env`, depois `.dev.vars` e variáveis do processo; relatório sem
chaves em `build/emails/provider-check.json`.

Envio real somente com destinatário explícito:

```powershell
npm run email:check -- --send-to seu-email@example.com --test-sender --name SeuNome
```

`--test-sender` vale só nesse processo. Após verificar o domínio, omita a flag para testar o
remetente configurado. `--email-id ID` consulta o evento anterior sem reenviar.

`email:assets` gera as imagens dos emails e os tokens embarcados; `assets:build` e `assets:check`
incluem a etapa (o check compara pixels e paleta, não os bytes do zlib). As prévias embutem as
imagens como data URI e funcionam offline. `email:samples` e `email:check` apontam as imagens para a
API de produção (ou `--art-base https://…`), que só as tem depois de um deploy com o ADR-041.
Somente a API chama Resend. Sem retry automático.
