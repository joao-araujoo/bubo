# Emails do Bubo

## Modelos implementados

Emails em português, com logo e poses oficiais, fundo lavanda, botão roxo, preheader,
texto simples e layout de tabelas. Imagens inline CID, sem R2 público, tracking ou dependência
nova. PNGs e tokens vêm dos mesmos assets/tema do app, sem redesenho ou recoloração.

| Situação                      | Gatilho                                    | Mensagem e ação                                      |
| ----------------------------- | ------------------------------------------ | ---------------------------------------------------- |
| Boas-vindas + confirmar email | Um envio após cadastro, quando há provedor | “Tem um lugar para você aqui.” → Confirmar meu email |
| Recuperar senha               | Pedido explícito do leitor                 | “Vamos reencontrar sua estante?” → Criar nova senha  |
| Senha alterada                | Redefinição efetiva                        | “Senha nova. Livros de sempre.” → Entrar no Bubo     |

Acolhimento e confirmação estão juntos para evitar dois emails no cadastro. Links de autenticação
duram 1 hora; reset é de uso único. Confirmação continua opcional, preservando auto sign-in e contas
existentes. Não há reenvio a cada login. Falha do provedor não bloqueia o cadastro nem interrompe
a revogação de sessões após reset. Sem provedor, produção responde 503 uniforme às ações de email.
Redirects/origins continuam protegidos. O callback padrão de confirmação é `bubo:///`.

O aviso de senha alterada orienta a usar “Esqueci minha senha” se a mudança não for reconhecida.
O botão `bubo:///entrar` depende do cliente de email permitir deep links; a instrução textual
para abrir o app funciona como alternativa. Links de confirmação/reset usam HTTP(S) do Better Auth.
Aceite dos links nos clientes móveis continua no roteiro do aparelho.

## Casos estudados e próximos envios

O Duolingo descreve [lembretes personalizados com controle de repetição](https://blog.duolingo.com/hi-its-duo-the-ai-behind-the-meme/)
e [incentivo à construção de hábito](https://blog.duolingo.com/putting-in-work-the-habit-of-language-learning/).
Isso inspira a proposta do Bubo, sem presumir os mesmos resultados: carinho, uma ação clara,
momento oportuno, sem culpa ou ameaça de perder progresso.

| Caso futuro        | Elegibilidade e limite propostos                                                | Dependências                                                          |
| ------------------ | ------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Resumo semanal     | Opt-in de email + leitura real na semana; máximo 1/semana                       | Consentimento, cancelamento, deduplicação, dados reais                |
| Revisão disponível | Opt-in + revisão realmente oferecida; preferir inbox/push; máximo 1 email/dia   | Não duplicar o lembrete existente nem consumir a cota sem necessidade |
| Retomar leitura    | Opt-in + 7 dias reais sem atividade; intervalo mínimo de 30 dias entre convites | Cancelamento; omitir se o leitor já voltou                            |
| Convite de clube   | Ação explícita e destinatário autorizado; um envio por convite, sem spoilers    | Tratar abuso/bloqueios; compartilhamento já existe no app             |

São recomendações documentadas, **não disparos ativados**. Antes de campanhas: opt-out simples,
supressão de bounces/reclamações, limites e dados reais. Não expor livros privados nem conteúdo
de clubes sem consentimento. Os emails transacionais de conta têm prioridade.
O [plano gratuito](https://resend.com/pricing) permite atualmente 3.000 emails/mês e 100/dia.
Não habilitar planos pagos, cobrança por excedente ou automações para este teste.

## Evidência e ativação

Em 2026-10-01, a chave do `.env` autenticou no Resend. O teste com os novos modelos recebeu
`last_event: delivered` e foi encontrado em **INBOX** no Gmail do dono, com logo e welcome inline.
Usou `onboarding@resend.dev`, que [só envia ao dono da conta](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).
Isso comprova o teste, não o futuro remetente personalizado.

`bubo.nyoneo.com.br` foi preparado no Resend, com tracking desligado e recebimento desativado.
O dono adiou DNS/verificação; não há navegador conectado disponível para operar a Hostinger.
O remetente do `.env` foi preparado; os secrets do Worker ainda não foram alterados.
O `.env` não configura sozinho a API publicada ou `apps/api/.dev.vars`.
Os modelos foram publicados na API após `npm run verify` (340 testes); health/ready responderam 200. Sem os secrets de email, não há disparos automáticos e as ações de email respondem 503.
Passos e valores exatos: [emails-dns.md](emails-dns.md).

## Comandos

```powershell
npm run email:preview
npm run email:check
```

Prévias: `build/emails/index.html`; não leem credenciais nem enviam emails. Links `example.test`
são exemplos. `npm run email:preview -- --serve` serve em `http://127.0.0.1:8669`.
Não houve inspeção visual de navegador nesta sessão; chegada e anexos inline foram conferidos no Gmail.
O diagnóstico é read-only: lê `.env`, depois `.dev.vars` e variáveis do processo; relatório sem
chaves em `build/emails/provider-check.json`. Chaves só de envio podem recusar consultas (403);
use o painel para diagnóstico, sem ampliar permissões da chave de runtime.

Envio real somente com destinatário explícito:

```powershell
npm run email:check -- --send-to seu-email@example.com --test-sender --name SeuNome
```

`--test-sender` vale só nesse processo. Após verificar o domínio, omita a flag para testar o
remetente configurado. `--email-id ID` consulta o evento anterior sem reenviar. Aceite com ID
não comprova inbox; observe o evento e confira a mensagem.

`email:assets` atualiza PNGs/tokens embarcados; `assets:build` e `assets:check` incluem a etapa.
Somente a API chama Resend. Logs têm categoria/ID/status, sem chave, destinatário, corpo ou link
de autenticação. Idempotência usa hash do evento/link, sem token no header. Sem retry automático.
