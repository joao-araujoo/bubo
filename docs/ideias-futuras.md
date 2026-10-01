# Ideias futuras — leitura, memória e identidade

Registradas pelo proprietário em 2026-09-30. Todos os itens abaixo são backlog, não recursos
implementados. A ordem sugere dependências, sem prometer datas ou substituir as Tasks 06–09
do [roadmap](roadmap.md). Cada checkbox representa uma entrega com os critérios descritos.

## 1. Confiança e facilidade para voltar a ler

- [ ] **01 — Sessão de leitura recuperável.** Persistir sessão ativa, UUID e estado do
      cronômetro; sobreviver a fechamento, encerramento pelo sistema e reinício do aparelho.
      Ao retornar, oferecer Continuar, Encerrar ou Descartar. Testar pausas, relógio alterado,
      offline e retry sem duplicar sessão; descartar não gera atividade.
- [ ] **02 — Antes de voltar.** Antes de Continuar leitura, apresentar página onde parou,
      última reflexão e pergunta curta opcional para reativar a memória. Sempre permitir
      pular e começar imediatamente; ausência de reflexão não bloqueia leitura.
- [ ] **03 — 5 minutos bastam.** Ação “Ler só 5 minutos” inicia uma sessão normal. Aos cinco
      minutos, aviso leve de meta cumprida, com liberdade de encerrar ou continuar, sem punição
      ou desafio obrigatório. Depende da recuperação confiável da sessão (01).
- [ ] **04 — Ritmo semanal.** Escolher 3, 4 ou 5 momentos por semana e mostrar, por exemplo,
      3 de 4 concluídos. Definir momento válido, início da semana, fuso e mudança de meta;
      derivar de sessões reais, sem exigir abrir o app todos os dias.
- [ ] **05 — Progressão visual da meta.** Evolução semanal: Bubo encontra livro, lê,
      acumula leituras e comemora. Reiniciar a cena semanalmente, sem apagar histórico.
      Usar exclusivamente poses oficiais próximas; poses ausentes ficam needs-confirmation.
      Compartilhar estado com widgets e respeitar redução de movimento. Depende de 04.
- [ ] **06 — Hoje adaptativo.** Uma ação principal clara conforme contexto: revisão vencida,
      retorno após afastamento com cinco minutos, continuidade após sessão, ou leitura quando
      não há cards pendentes. Definir prioridades determinísticas e testar conflitos; não
      ocupar espaço com Revisar vazio nem tornar lembranças repetitivas.

## 2. Citações e memória pessoal do livro

- [ ] **07 — Guardar citações.** Salvar texto, livro, página e observação opcional; editar
      e excluir. Mostrar no livro e na área pessoal. Preservar autoria/origem e nunca inventar
      trechos. Base para cards, retrospectivas e Pontes.
- [ ] **08 — Bubo Lens.** Fotografar página, reconhecer texto, selecionar trecho e revisar
      antes de salvar como citação no livro atual; informar/corrigir página. Tratar permissão
      negada, OCR incorreto e falha de rede; manter digitação manual. Definir processamento e
      descarte da foto antes de implementar. Depende de 07.
- [ ] **09 — Citação → memória.** Após salvar, oferecer discretamente “Quero lembrar disso”.
      Criar card de recall ligado ao trecho com confirmação e retry idempotente. Se houver
      Gemini, somente via API/GeminiService; preservar o texto original. Depende de 07.
- [ ] **10 — O que ficou.** Área pessoal do livro reúne progressivamente citações,
      reflexões, cards importantes, ideias recorrentes e momentos relevantes. Ao concluir,
      preservar memória afetiva da leitura, sem reduzir a experiência a estatísticas.
- [ ] **11 — Encerramento especial de livro.** Mostrar período, páginas, tempo focado,
      sessões, citações, reflexões e registros reais. Pergunta opcional: “O que você gostaria
      de ainda lembrar deste livro daqui a um ano?”. Guardar resposta para revisitas;
      definir comportamento em releituras e conclusão sem sessões.
- [ ] **12 — Livro que ficou comigo.** Marca distinta de favorito, com poucos livros
      escolhidos pelo usuário e destaque no perfil. Definir limite e visibilidade; representar
      identidade sem incentivar centenas de favoritos.

## 3. Reencontros e evolução do pensamento

- [ ] **13 — Cápsula de leitura.** Agendar reflexão para 30 dias, seis meses ou um ano.
      Ao reaparecer, mostrar primeiro o pensamento original e depois perguntar se permanece.
      Permitir cancelar; controlar frequência. Entrega no app independe de push; notificações
      dependem da Task 09 e das preferências do usuário.
- [ ] **14 — Eu ainda penso assim?** Em reflexões antigas: Ainda penso assim, Mudei de
      ideia ou Não sei mais, com nova reflexão opcional. Construir linha do tempo preservando
      original, data e vínculo; permitir corrigir/excluir a nova resposta.
- [ ] **15 — Reencontro surpresa.** Raramente mostrar em Hoje uma citação, reflexão ou
      resposta antiga com idade real (“Você escreveu isso há 214 dias”). Definir intervalo,
      dispensa e não repetição; não virar card obrigatório diário.
- [ ] **16 — Sua estante está viva.** Indicadores contextuais de tempo sem visita, cards
      ainda revisados e conexões recentes. Exibir somente quando houver evidência; definir
      registro de visitas. Sem transformar indicadores em notificações.

## 4. Conexões pessoais entre ideias

- [ ] **17 — Pontes entre livros.** Relacionar reflexões, citações, cards e ideias de
      livros distintos sem tags manuais; mostrar os dois contextos lado a lado. Gemini
      server-side pode sugerir conexão, sempre com fontes reais e opção de descartar.
- [ ] **18 — Pontes com o próprio passado.** Relacionar pensamento antigo e atual,
      indicando datas e contextos (“Há 8 meses…”). Mudança de interpretação deve ser uma
      sugestão confirmável pelo leitor, nunca diagnóstico automático. Depende de 14 e 17.
- [ ] **19 — Livro gêmeo.** Encontrar dois livros próximos na experiência pessoal pelas
      reflexões, citações e conceitos, além do gênero. Mostrar conceitos e registros em comum;
      não fabricar pares com dados insuficientes. Depende de 17.
- [ ] **20 — Coleções automáticas.** Gerar apenas com evidência suficiente: Leituras de
      madrugada, Livros que terminei rápido, que mais me fizeram refletir, que ainda revisito,
      Leituras mais longas e Livros que ficaram comigo. Explicar critérios e permitir ocultar.

## 5. Retrospectivas e expressão pessoal

- [ ] **21 — Bubo Replay mensal.** Retrospectiva visual com livros lidos/iniciados,
      minutos, dias, páginas, gênero predominante, citação favorita, livro mais revisitado,
      melhor sequência, Pontes e reflexão marcante. Definir métricas, período/fuso e dados
      mínimos; omitir dimensões indisponíveis. Depende de 07/17 para citações/Pontes.
- [ ] **22 — Cards compartilháveis da retrospectiva.** Artes verticais para Stories,
      escolhidas e pré-visualizadas pelo usuário: Meu mês em livros, Minha frase do mês,
      O livro que mais ficou comigo, 732 minutos lendo, Minha estante de setembro. Valores
      exemplificativos nunca entram como dados reais. Identidade Bubo sem aparência de anúncio.
- [ ] **23 — Bubo Replay anual.** Evolução mensal de livros, tempo, sessões, gêneros,
      autores, citações e memória. Destacar maior mês, livro mais revisitado, ideias que ligam
      livros, horário favorito, maior sessão, livro que levou mais tempo e evolução do ritmo.
      Compartilhável, com critérios transparentes e suporte a histórico parcial.
- [ ] **24 — Minha frase do mês.** Selecionar somente citação real salva naquele mês;
      permitir trocar antes de compartilhar arte com texto, livro e capa. Sem citação elegível,
      mostrar estado vazio. Depende de 07 e 22.
- [ ] **25 — Cartão de livro concluído.** Imagem com capa, período, foco, sessões,
      páginas e “O que ficou comigo”, escolhidos pelo leitor. Identidade própria Bubo, sem
      copiar Letterboxd; tratar ausência de capa e texto longo. Depende de 11 e 22.
- [ ] **26 — Mapa do ano de leitura.** Dias de leitura e revisão em calendário ou estante
      crescente. Toque no dia abre eventos reais daquela data; distinguir leitura de revisão,
      respeitar fuso e oferecer alternativa acessível sem depender só de cor.
- [ ] **27 — Seu jeito de ler.** Padrões reais de horário, duração/frequência por gênero
      e dia da semana, sem notas nem julgamento. Exigir amostra mínima, explicar período e
      não inferir gênero quando o catálogo não informa.
- [ ] **28 — DNA de leitura compartilhável.** Composição de horários, gêneros, ritmo,
      duração média e perfil de leitura com prévia e escolha do conteúdo. Depende de 27 e 22.

## 6. Presença no sistema do celular

- [ ] **29 — Widget: Continuar leitura.** Capa, título, página e progresso do livro
      atual; toque abre livro ou inicia sessão. Deep link autenticado e estado vazio honesto;
      atualizar após sessões e saída da conta.
- [ ] **30 — Widget: Ritmo da semana.** Dias com leitura e meta (3/4), Bubo e estados
      visuais compatíveis com as limitações da plataforma. Depende de 04 e 05.
- [ ] **31 — Widget: Completo.** Versão média/grande com livro atual, progresso, meta,
      dias ativos, próxima revisão e continuar; painel legível, com prioridades claras.
- [ ] **32 — Widgets com estados do mascote.** Ler, comemorar meta, descansar sem
      pendências, segurar cards com revisões e dormir à noite. Mapear somente assets oficiais;
      documentar pose equivalente ou needs-confirmation. Nunca redesenhar/recolorir Bubo.
- [ ] **33 — Widget na tela bloqueada.** Versões compactas com página, ritmo, revisões
      e voltar ao livro. Configurar privacidade do título/capa em tela bloqueada; validar
      suporte por plataforma em build nativo e aparelho.
- [ ] **34 — Live Activity durante a sessão.** Tempo, título/capa e estado na tela
      bloqueada/Dynamic Island quando disponível; notificação persistente equivalente no
      Android. Sincronizar pausa, retomada e encerramento com 01; não depender de timer JS
      em background. Requer avaliação nativa, permissões e teste em aparelhos reais.

## Critérios transversais e sequência sugerida

1. Consolidar validação das telas existentes e concluir o recorte atual de Minha memória.
2. Confiabilidade da sessão (01), retomada (02–03), citações (07) e recall (09).
3. Memória do livro (10–14), ritmo (04–06), reencontros (15–16) e mapa (26).
4. Pontes (17–20), insights e Replay (21–28); Lens (08) após definir OCR/privacidade.
5. Widgets e atividades do sistema (29–34) após sessão persistente e validação nativa.

Essa sequência não remove as pendências de resenhas, amizades, ciclos, moderação e push.
Antes de cada implementação, verificar estado atual para não duplicar recursos já entregues.

- Dados pessoais isolados por conta; exclusão/exportação devem acompanhar novos registros.
- Sugestões de IA não substituem nem alteram pensamentos ou citações originais. Gemini somente
  na API; nunca chaves no app. Definir consentimento, custo e retenção para OCR e semântica.
- Compartilhar é uma ação explícita após prévia; reflexões permanecem privadas por padrão.
  Se conteúdo virar publicação, incluir denúncia, bloqueio, exclusão pelo autor e moderação.
- Cinco abas, tokens, acessibilidade, alvos de 48 e assets oficiais continuam obrigatórios.
- Cada entrega exige testes adequados, `npm run verify`, documentação e roteiro em aparelho;
  build e testes automatizados não substituem aceite visual/nativo.
