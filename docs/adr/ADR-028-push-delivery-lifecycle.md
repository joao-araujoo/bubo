# ADR-028 — Entrega e ciclo de vida de notificações push

Status: aceito em código local; ativação/homologação dos provedores e aparelhos pendente.
Data: 2026-10-03. Complementa ADR-022. Migração: `0015_reader_push_receipts.sql`.

## Contexto

O registro original persistia tokens por conta, tratava ticket Expo como entrega e não consultava
recibos FCM/APNs. O job marcava o dia antes de criar o item de inbox; duas execuções simultâneas
podiam duplicar o aviso. Logout offline esquecia o token antes de removê-lo remotamente. Prefixos
de URL excessivamente amplos e notificações antigas podiam navegar ao trocar de conta.

## Decisão

- Tokens recebem o ID do login (`sessions`) no servidor. Exclusão/revogação desse login remove
  os tokens por cascade; a seleção de entrega exclui sessões expiradas e registros antigos sem
  vínculo. Nenhum ID/chave de sessão é entregue ao app para esse fim.
- Tickets aceitos são persistidos em `reader_push_receipts`; o cron consulta depois de 15 minutos,
  retém os ainda ausentes e expira em 23 horas. Recibo atrasado nunca apaga um token re-registrado
  depois do envio: compara uma geração UUID, sem depender de relógios/timestamps. Recibo de um
  token revogado no meio do lote não interrompe a persistência dos outros. Recusa HTTP 429 recebe
  uma tentativa com backoff; timeout/rede ambígua não é reenviado. Logs omitem tokens e mensagens
  livres dos provedores.
- `sent` conta aceitação pelo Expo. Sucesso do recibo atesta recepção pelo provedor, e só teste em
  aparelho comprova exibição. Falhas de push não falham ações de leitura/comunidade.
- Lembretes exigem consentimento novamente no envio. A reclamação do dia local e a escrita de
  inbox são transacionais; o número anunciado respeita revisões disponíveis e orçamento diário.
- Cada push inclui a conta destinatária. O app só navega por rota completa permitida para a conta
  atual, deduplica respostas e consulta registro/permissão ao retornar. Rotação nativa do token
  renova o registro Expo.
- Permissão é solicitada por ação explícita. iOS provisório é reconhecido. Builds sem UUID Expo
  mostram indisponibilidade antes de pedir permissão. Logout mantém retirada pendente durável
  quando offline e limpa alertas locais quando possível.
- O texto de revisão alterna seis variantes curadas, positivas e sem culpa. Não depende de Gemini
  nem transporta reflexões, trechos ou respostas; categorias mantêm controles independentes.

## Consequências e limites

Exige aplicar a migração antes de publicar a API e renovar registros existentes. FCM/APNs/UUID
Expo ainda dependem do dono; a compilação Swift exige ambiente Apple. Uma mensagem já em trânsito
não pode ser recolhida. Logout sem conexão não garante revogação remota imediata, embora o token
seja removido quando o servidor revoga a sessão ou a retirada pode ser concluída.

Inbox é a fonte durável; não há reenvio cego de falha de envio ambígua. O cron atende até 500
leitores elegíveis por execução, e lotes são espaçados no fluxo de envio; escala maior precisa de
fila/controle global de vazão. Push não possui garantia de entrega/exibição. A configuração local
é diagnosticada por `npm run push:check`, que não envia nada nem mostra credenciais.

Detalhes, referências oficiais e roteiro de aceite em [notifications.md](../notifications.md).
