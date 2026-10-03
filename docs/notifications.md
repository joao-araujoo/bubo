# Notificações do Bubo

Atualizado em 2026-10-03. O código foi validado com banco local em memória e serviços simulados;
API e migração foram publicadas conforme [release.md](release.md).
Receber uma notificação em Android/iPhone ainda exige a configuração do dono e homologação real.

## Comportamento

- Revisão é opt-in: vem desligada até o leitor ativar. Há no máximo um lembrete por dia local,
  no horário escolhido, somente se existirem cartões vencidos que caibam no limite diário restante.
- O Bubo alterna seis mensagens curadas, leves e divertidas. Não usa culpa, ameaças, promessas de
  desempenho nem IA para inventar textos no push. Exemplo: "Sua memória pediu um bis".
- Respostas/ciclos e amigos têm controles independentes. Desligar o push mantém a caixa de entrada.
- Notificações nunca levam respostas, trechos ou reflexões. Push social usa nomes e nomes de clubes.
- Android separa os canais `lembretes` e `comunidade`, com visibilidade privada na tela bloqueada.
  No iPhone, a apresentação da prévia segue as configurações do sistema.
- O pedido de permissão só acontece em uma ação explícita para ativar notificações/lembretes.
  Salvar tema, meta ou outra preferência não abre um pedido de permissão. Retornar ao app apenas
  consulta a permissão e renova o registro existente, sem abrir um novo pedido.
- Permissão provisória do iOS é aceita. Uma build sem projeto Expo configurado mostra
  indisponibilidade antes de pedir permissão. Expo Go Android não carrega o módulo de push.
- O token pertence ao login que o registrou. Logout/revogação/exclusão da sessão no servidor remove
  esse registro; sessões expiradas não recebem novas entregas. Trocar conta exige ativação própria.
- Um toque abre apenas uma rota completa conhecida e só para a conta que recebeu a notificação.
  Toques duplicados não empilham a mesma tela. O app atualiza a caixa de entrada quando recebe push.
- Ao sair, tenta retirar o token e limpar alertas já exibidos. Se a retirada falhar offline, a
  remoção fica persistida para nova tentativa quando a mesma conta retornar. Uma mensagem já
  aceita por FCM/APNs pode aparecer depois; o app recusa sua navegação se a conta for outra.

## Entrega, recibos e limites

`0015_reader_push_receipts.sql` vincula tokens a sessões e persiste os IDs dos tickets Expo.
Tokens antigos sem vínculo ficam excluídos até o registro automático por uma sessão válida.

`deliverPush` verifica as preferências novamente, envia lotes de até 100 e deixa 200 ms entre
lotes do mesmo envio. Isso limita esse fluxo a 500 mensagens/s; o limite global de 600/s por
projeto Expo também deve ser observado ao aumentar a escala de requisições concorrentes.
O retorno `sent` no job é quantidade de tickets aceitos pelo Expo, não de aparelhos que mostraram
a notificação. Timeout, payload inválido e falha de serviço ficam em logs agregados, sem tokens.

O cron horário consulta tickets com pelo menos 15 minutos. Recibos ausentes/falhas de consulta
ficam para a próxima execução; isso não reenvia mensagens. Recibos resolvidos são removidos.
Pendências expiram em 23 horas, antes de o Expo limpar recibos em 24 horas. `DeviceNotRegistered`
remove o token apenas se ele não foi registrado novamente depois do envio.
Cada registro tem uma geração UUID imutável; essa checagem independe de precisão de timestamp
ou sincronização de relógios. Revogar um token durante um lote não abandona os recibos dos outros.
Uma recusa HTTP 429 recebe uma nova tentativa com backoff limitado; falha de rede/timeout não
provoca reenvio automático porque o Expo pode já ter aceitado o pedido.

O cron seleciona até 500 leitores elegíveis, ordenados pela data do último lembrete, e reclama
cada dia em uma transação com a criação da caixa de entrada. Execuções sobrepostas não duplicam
esse item; uma falha na escrita desfaz a reclamação. Acima desse volume por faixa horária será
necessário ampliar a frequência/capacidade do job.
Com mais de 500 elegíveis na mesma hora, leitores restantes podem ficar sem push naquele dia;
a caixa de entrada continua disponível. Essa capacidade não é uma garantia de entrega diária.
A hora e data seguem o fuso IANA salvo, incluindo deslocamentos fracionários e transições de
horário de verão. Ao viajar, salvar as
preferências atualiza o fuso usado pelo lembrete.

A caixa de entrada é persistida antes da entrega. Um push recusado/ambíguo não compromete a ação
nem duplica o lembrete com reenvio cego. Push não é um canal de entrega garantida e não substitui
a caixa de entrada.

## Configuração do dono

Execute `npm run push:check`. É um diagnóstico somente leitura: não envia notificações, não
altera provedores e não imprime credenciais. Campos presentes não comprovam credenciais remotas.

1. Escolha/vincule o projeto Expo da conta do dono. Copie seu UUID público para
   `BUBO_EAS_PROJECT_ID` em `apps/mobile/.env` ou no ambiente da build. A configuração nativa
   inclui o UUID em `extra.eas.projectId`; ele não é uma chave secreta.
2. Android: configure no Firebase o pacote `com.joaoaraujo.bubo` e a Cloud Messaging API v1.
   Guarde `google-services.json` fora do repositório e informe seu caminho em
   `GOOGLE_SERVICES_JSON`. A credencial privada da conta de serviço FCM v1 deve ficar apenas nas
   credenciais Expo correspondentes. Nunca inclua essa chave no app, `.env` público ou Git.
3. iOS: a conta Apple deve configurar APNs, assinatura/provisioning e o bundle
   `com.joaoaraujo.bubo`. O plugin `expo-notifications` registra os recursos nativos; confirmar
   `aps-environment` na build assinada e a credencial APNs no projeto Expo. A compilação e a
   homologação do iPhone precisam de macOS/Xcode e recursos da conta Apple.
4. Gere uma nova build depois da configuração. O APK local é gratuito e não exige EAS Build
   pago; o transporte via Expo ainda depende do UUID e de FCM/APNs configurados. Use
   `npm run build:android` e as instruções em [build-mobile.md](build-mobile.md).
5. A API de produção já tem a migração `0015` e o cron horário. Publicação e evidências em
   [release.md](release.md); nenhuma conta Expo, credencial FCM/APNs ou configuração DNS foi criada.

Em 2026-10-03, o diagnóstico local não encontrou `BUBO_EAS_PROJECT_ID` nem `GOOGLE_SERVICES_JSON`.
O manifest do módulo Expo instalado declara `POST_NOTIFICATIONS`, confirmada no APK final;
não é necessário duplicar essa declaração no manifest da aplicação. Assinatura, quatro
receptores de widgets e JavaScript embarcado também foram conferidos.

## Homologação em aparelhos

1. Android 13+: permita o push pela ação "Ativar notificações"; negue em outra execução e
   confirme a opção de abrir ajustes. No iPhone, valide permitido, negado e provisório.
2. Ative o lembrete e escolha uma hora local com cartões disponíveis. Confirme um aviso naquele
   dia; rodar novamente não cria duplicata. Sem cartões/limite restante, não deve haver lembrete.
3. Com app aberto, em segundo plano, fechado e tela bloqueada, confira exibição e privacidade.
   Silencie o canal Android e confirme que o sistema respeita a escolha.
4. Toque em revisão, amizade, discussão/resenha e ciclo. Valide abertura com app frio e quente,
   sem duas telas iguais. Um push para outra conta ou rota inválida não pode navegar.
5. Desative categorias e permita a caixa de entrada continuar recebendo avisos. Revogue a
   permissão nos ajustes e retorne ao app: registro anterior deve ser retirado sem novo prompt.
6. Saia online e confirme remoção do token. Teste logout offline/reentrada; uma mensagem já em
   trânsito pode chegar, mas não deve abrir dados de outra conta.
7. Consulte os recibos após o cron. Ticket aceito, recibo FCM/APNs aceito e notificação visível
   são três evidências diferentes. Nunca registre tokens/chaves no relatório de homologação.

## Referências oficiais

- [Expo: envio, tickets, recibos, limites e erros](https://docs.expo.dev/push-notifications/sending-notifications/).
- [Expo: configuração FCM/APNs e teste de push](https://docs.expo.dev/push-notifications/push-notifications-setup/).
- [Expo Notifications: permissões, canais e listeners](https://docs.expo.dev/versions/latest/sdk/notifications/).
- [Apple: pedido de permissão e autorização provisória](https://developer.apple.com/documentation/usernotifications/asking-permission-to-use-notifications).

Essas referências orientam a implementação; não representam prova de entrega no projeto do dono.
