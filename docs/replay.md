# Bubo Replay e Stories

O Replay transforma a leitura registrada em uma retrospectiva mensal ou anual. O Story de livro
é uma arte escolhida pelo leitor, com capa, título, autoria e uma nota opcional. As duas experiências
usam a identidade do Bubo, prévia antes de compartilhar e dados reais da própria conta.

Implementação local em 2026-10-04 ([ADR-034](adr/ADR-034-replay-and-book-stories.md)).
`npm run verify` passou com **541 testes**: formato, lint, tipos, assets e auditoria verdes.
Prebuild, compilação Kotlin do módulo, manifest Android e bundle Android de release foram
conferidos. Um APK debug completo foi compilado e instalado no emulador Android; a verificação
visual e da exportação no emulador foi interrompida e não chegou ao fim (código revisado e
`verify` repetido em 2026-10-04). Publicação da API, nova build
standalone aceita em aparelho físico, compilação Swift e entrega ao Instagram permanecem
pendentes; os checks de código/compilação não comprovam essas etapas.

## Onde encontrar

- **Você → Bubo Replay:** escolha mês ou ano, percorra os capítulos e abra o relatório completo.
- **Estante → livro → Compartilhar livro:** escolha Papel, Noite ou Violeta e, se quiser, uma nota.
- **Compartilhar capítulo:** prepara a arte vertical do capítulo atual do Replay.

Os capítulos avançam por ação do leitor. A transição é breve e respeita **Reduzir movimento**;
não há reprodução automática, contagem regressiva ou obrigação de compartilhar.

## O que os números significam

O endpoint autenticado `GET /v1/me/replay` calcula o relatório a partir das sessões aceitas da
conta. Recebe `kind=month|year`, `year=2020..2100`, `month=1..12` somente no recorte mensal e um
`timeZone` IANA, por exemplo `America/Sao_Paulo`; `UTC` também é aceito. Períodos futuros são
recusados. Não usa o rascunho local, tempo de app aberto, visitas ou adição de livros como atividade.

`generatedAt` informa o instante em que o servidor gerou o relatório. Em um período atual, a arte
mostra **até DD/MM** dessa geração no fuso escolhido, em vez de atribuir um snapshot antigo a
hoje. A tela também informa quando os dados foram atualizados. O Replay não entra no cache
persistente e solicita atualização ao abrir; sem conexão e sem relatório em memória, apresenta
um estado de offline, sem spinner interminável. Um snapshot em memória mantém sua data real.

| Informação                    | Fonte e interpretação                                                                                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Livros com leitura            | Livros distintos com pelo menos uma sessão aceita no período.                                                                                                                                                |
| Livros iniciados              | A primeira sessão registrada daquele livro ocorreu no período; não afirma a data em que a pessoa começou a ler fora do Bubo.                                                                                 |
| Livros concluídos             | O primeiro cruzamento registrado da última página conhecida ocorreu no período (`startPage < totalPages` e `endPage ≥ totalPages`). A mudança manual para **Já li** não comprova conclusão naquele mês/ano.  |
| Páginas                       | Soma dos avanços positivos das sessões aceitas. Alterar a página manualmente não cria páginas lidas.                                                                                                         |
| Minutos de foco               | Soma de `focusedSeconds`, convertida em minutos; pausas não entram.                                                                                                                                          |
| Sessões                       | Registros aceitos, uma vez por UUID; retries não duplicam o relatório.                                                                                                                                       |
| Dias de leitura               | Datas locais distintas com sessão no período. Revisões não viram leitura.                                                                                                                                    |
| Melhor sequência de leitura   | Dias consecutivos com sessões reais dentro do período. Não inclui proteção de sequência nem dias só de revisão.                                                                                              |
| Livro mais presente           | Exige pelo menos duas sessões; ordena por sessões, foco e identificador. Não afirma releitura do livro nem recordação por cards.                                                                             |
| Autores em destaque           | Até cinco autorias, por foco, quantidade de livros e nome. O texto de autoria cadastrado é mantido inteiro, sem separar coautorias por vírgula nem inventar autoria ausente.                                 |
| Horário mais frequente        | Exige pelo menos cinco sessões e uma hora de início mais frequente sem empate, no fuso escolhido. Ausência de evidência mantém a dimensão oculta.                                                            |
| Maior sessão                  | Maior tempo de foco aceito; empate é resolvido pelo identificador.                                                                                                                                           |
| Jornada mais longa registrada | Entre livros com conclusão comprovada no período, intervalo em dias de calendário entre a primeira sessão e a conclusão, incluindo os extremos. Não estima dias efetivamente passados lendo.                 |
| Mês em destaque               | Maior foco, depois páginas, depois ordem do mês; sem sessões, não há vencedor.                                                                                                                               |
| Evolução mensal               | Doze meses no relatório anual; um no mensal. Meses sem registros mostram zero. Meses futuros no ano atual ainda não aconteceram; zero não representa leitura encerrada nem ausência de leitura fora do Bubo. |

O instante de encerramento `endedAt`, convertido no fuso escolhido, determina o dia e o mês/ano
da sessão. Alterar o fuso pode mover uma sessão perto da meia-noite para outro dia/período. O
horário mais frequente usa `startedAt` nesse mesmo fuso. O relatório explicita o período e o
histórico parcial: não há sessão alguma, ou a primeira registrada é posterior ao início do
período. O período mantém as datas completas do calendário; quando tem `inProgress`, inclui
somente os registros encerrados até agora. Registros futuros não entram. Os recortes não estimam
leitura anterior à primeira atividade registrada.

`shelf_entries.finishedAt` pode ser apenas o instante de uma declaração **Já li**, inclusive de
leitura antiga (ADR-033). O Replay não converte essa declaração em sessão, páginas, tempo ou
conclusão comprovada. Livros removidos levam consigo as sessões conforme a política existente;
o Replay reflete os registros atualmente disponíveis, sem manter uma cópia oculta do histórico.
As conclusões usam o total de páginas conhecido atualmente; corrigir esse metadado pode mudar
o cruzamento observado. Sem total conhecido, não há conclusão comprovada por páginas.

Os critérios de desempate dão estabilidade ao destaque, sem afirmar um máximo exclusivo quando
o critério principal empata: as artes dizem **Um dos livros a que mais voltei** e o relatório
**Um dos meses com mais tempo de leitura**.

Gêneros, citações favoritas, Pontes e reflexões marcantes ainda não têm as fontes necessárias neste
recorte. Permanecem omitidos. A nota do Story é uma escolha pessoal para aquela arte: não mede
memória, não altera o livro e não publica uma resenha na Comunidade.

## A arte e a privacidade

As artes têm formato **1080 × 1920, PNG**, com capa em destaque, tipografia Plus Jakarta Sans,
formas simples e uma marca oficial pequena. O conteúdo principal respeita uma área central para
as ferramentas e legendas do Instagram. A prévia e a exportação representam a mesma composição;
controles do Bubo ficam fora da imagem.

Papel, Noite e Violeta são estilos próprios definidos em tokens. O logo e as poses oficiais não
são redesenhados ou recoloridos. Capa ausente ou indisponível usa a apresentação tipográfica
existente, sem inventar uma imagem. Títulos e autorias extensos continuam legíveis na prévia.

O Story do livro mostra apenas os dados selecionados da estante e, se houver, a **nota**
privada de 1 a 5 salva no livro (ADR-035), com a opção "Mostrar nota na arte". A nota nunca é
enviada à Comunidade. Sem nota, a arte não mostra estrelas vazias ou uma avaliação inferida.

Composição do Story do livro (pedido do dono, 2026-10-04): coluna centralizada com o status
simples ("JÁ LI", "LENDO AGORA"…), a capa reta e grande (cerca de metade da largura), título, autoria, estrelas pequenas
sem rótulo quando houver nota e, abaixo, `— NO —` com o logo oficial centralizado. No Papel o
logo vai direto no fundo; em Noite e Violeta fica numa plaquinha branca, porque o logo tem tinta
escura e não pode ser recolorido. No Replay o logo também fica centralizado e sem frase ao lado.

Recordações, exercícios, respostas de cards e reflexões privadas não entram nas artes. Não há
publicação automática, página pública de Replay nem mudança da preferência de compartilhar
atividade com amigos. Salvar ou compartilhar exige uma ação explícita após a prévia. A publicação
final continua sendo uma escolha do leitor no aplicativo de destino.

## Instagram, compartilhar e salvar

Uma build nativa com o módulo local `bubo-stories` oferece compartilhamento de imagem e salvamento.
O envio direto ao editor de Stories também exige Instagram instalado e um **App ID real da Meta**
configurado em `EXPO_PUBLIC_INSTAGRAM_APP_ID`. Esse identificador é público; não use token,
segredo de aplicativo nem senha. A configuração é opcional e não impede usar as outras ações.

O botão prepara a arte e abre o editor disponível; não publica em nome da pessoa. A versão do
Instagram, o sistema e a configuração da Meta podem afetar o recebimento da imagem. Quando o envio
direto não estiver disponível, use o compartilhamento do sistema ou salve a imagem e abra-a no
Instagram. Falhas deixam a prévia e as alternativas disponíveis, com mensagem para tentar de novo.

O Expo Go não contém o módulo local de Stories. Ele mostra as telas/prévias e explica a necessidade
de uma nova build para exportar/entregar a arte. No Android, use o fluxo gratuito
`npm run build:android`; o iPhone requer compilação nativa no Xcode. Alterar apenas JavaScript ou o
App ID depois de instalar uma build não instala a configuração nativa.

`react-native-view-shot` 5.1.0 captura a composição PNG no aparelho; o módulo local entrega/salva
o arquivo pelas APIs do sistema. Não há serviço pago de renderização, chave de IA ou migração.
No Android 10+, salvar usa MediaStore sem acesso às fotos existentes. No iPhone, a permissão
**somente adicionar** é pedida ao salvar, sem ler a galeria.

Ao compartilhar, uma cópia temporária permanece no cache privado do app para o destino terminar
de lê-la. O próximo preparo de imagem limpa cópias desse diretório com mais de 24 horas; não há
um arquivo público de Replay. No iPhone, o envio direto ao Instagram usa o clipboard apenas local,
com validade de cinco minutos. As imagens que a pessoa salva na galeria permanecem por sua
escolha, independentemente da conta do Bubo. Veja [../CONFIGURAR.md](../CONFIGURAR.md) e o roteiro abaixo.

## Aceite em aparelho

O roteiro completo está em [TESTAR-TELAS.md](TESTAR-TELAS.md). Antes de considerar o recurso pronto
para uma publicação, confira:

1. Conta sem sessões, conta com um livro e períodos atuais/fechados: sem dados inventados.
2. **Já li** manual sem sessões: não adiciona atividade nem conclusão comprovada ao Replay.
3. Mês na virada de ano, histórico parcial, mudança de fuso perto da meia-noite e retries de UUID.
   Um relatório de ontem, mantido em memória sem rede, conserva a data do snapshot na arte.
4. Todos os estilos com capa real, capa ausente, título/autor longos, tema claro/escuro e fonte 1,6×.
5. Capítulos, relatório e compositor com TalkBack/VoiceOver e **Reduzir movimento**.
6. PNG salvo com 1080 × 1920, capa/fontes carregadas, sem controles, com marca oficial e sem texto privado.
7. Instagram instalado/ausente, App ID configurado/ausente, cancelamento, compartilhamento alternativo
   e permissão de fotos negada. No editor, confirmar nitidez e margens antes de publicar.
8. Trocar de conta enquanto carrega: a prévia, relatório e exportação não podem usar dados da conta anterior.

Compilação, autolinking e testes não substituem a abertura do editor de Stories em aparelhos reais.
