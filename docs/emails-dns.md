# Ativar o remetente do Bubo na Hostinger

Preparado em 2026-10-01. Domínio do Resend: `bubo.nyoneo.com.br`;
ID `9cfb0fca-15f7-43db-975e-79fb05dbff0a`. Rastreamento de abertura/cliques desligado;
recebimento de emails desligado. Cadastro do subdomínio no Resend não altera o DNS.

Quando puder, siga estes passos:

1. Entre em [hpanel.hostinger.com](https://hpanel.hostinger.com/).
2. Abra **Domínios → Portfólio de domínios → nyoneo.com.br → Gerenciar**.
3. Entre em **DNS / Nameservers** e localize **Gerenciar registros DNS**.
4. Para cada linha da tabela, selecione o **Tipo**, preencha **Nome** e **Valor/Aponta para**,
   mantenha TTL 3600 e clique em **Adicionar registro**. O MX também tem prioridade 10.

Se estiver em “Domínios externos”, clique em Gerenciar ao lado de `nyoneo.com.br`.
[Instruções oficiais da Hostinger](https://www.hostinger.com/br/support/1583249-como-gerenciar-seus-registros-dns-no-hpanel-hostinger/).
Os nameservers públicos atuais são `apollo.dns-parking.com` e `athena.dns-parking.com`.
Adicione os quatro registros abaixo. Os nomes são relativos à zona `nyoneo.com.br`;
não acrescente outro `.bubo` nem repita o domínio no campo de nome da Hostinger.

| Tipo  | Nome                     | Valor                                                                                                                                                                                                                        | Prioridade | TTL  |
| ----- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---- |
| TXT   | `resend._domainkey.bubo` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCojSwiFU0Gxi19tIULWtPntl+HdJD5VrIGValnuZxK6zIqxDSM855U6M1hXwCdQ7ewFlSiMrmyzvq8gCVdGjXK2tVQ9UUH6yYTugWH8DV5EMJRybRyfmOy9UWmHiPnysplYaAcGe4MjFtkUDJEesj+lHTINVDmdtepTm3Tg63VawIDAQAB` | —          | 3600 |
| MX    | `send.bubo`              | `feedback-smtp.us-east-1.amazonses.com`                                                                                                                                                                                      | 10         | 3600 |
| TXT   | `send.bubo`              | `v=spf1 include:amazonses.com ~all`                                                                                                                                                                                          | —          | 3600 |
| CNAME | `rsend.bubo`             | `send.forge.rmta.net`                                                                                                                                                                                                        | —          | 3600 |

São valores públicos retornados pela API do Resend para este subdomínio, não chaves privadas.
Na consulta pública inicial, esses quatro nomes ainda não existiam. Preserve os registros
atuais da startup, especialmente os MX/TXT do domínio principal. Este conjunto configura
somente o envio do Bubo e os retornos técnicos de entrega, não uma caixa de email.

O proprietário adiou esta configuração; nenhum registro foi alterado nesta sessão.
Depois de salvar, no Resend abra **Domains → bubo.nyoneo.com.br → Verify DNS Records**.
A propagação pode levar tempo; só ative o remetente quando o domínio estiver `verified`.
Não compre domínio/plano nem ative cobranças por excedente.

Remetente preparado: `Bubo <nao-responda@bubo.nyoneo.com.br>`. Depois da verificação,
atualize `EMAIL_FROM` nos arquivos locais privados e configure `RESEND_API_KEY` + `EMAIL_FROM`
nos secrets do Worker. Nenhuma chave deve entrar no código, no mobile ou neste guia.
O `.env` da raiz não configura sozinho o Worker publicado ou `apps/api/.dev.vars`.

Valide com `npm run email:check`, um envio ao dono da conta e `/v1/health` + `/v1/ready`.
`npm run email:check` não faz alterações de DNS nem envia emails por padrão.
Guia dos modelos e política de envio: [emails.md](emails.md).
