# Roteiro de testes — todas as telas do Bubo

Lista de **todas as telas que existem hoje**, como chegar em cada uma e o que conferir. Use quando
terminar as configurações de [../CONFIGURAR.md](../CONFIGURAR.md). Status de cada tela frente ao
Stitch: [screens.md](screens.md).

Última atualização: 2026-10-01 (Task 09 concluída — preferências, notificações e push). Total: 47 telas, mais 2 de desenvolvimento.

---

## Como rodar o app para testar

**Opção A — local, com Expo Go (funciona hoje, sem configurar nada):**

1. No computador: `npm install`, depois `npm run dev:api` e, em outro terminal, `npm run dev:mobile`.
2. Em `apps/mobile/.env`: `EXPO_PUBLIC_API_URL=http://<IP-do-computador-na-rede>:8787`.
   Em `apps/api/.dev.vars`: `BETTER_AUTH_URL=http://<mesmo-IP>:8787`.
3. Celular na mesma rede Wi-Fi → abra o Expo Go → leia o QR code.

Atenção: se o `apps/api/.dev.vars` tiver `DATABASE_URL`, o `dev:api` usa o **mesmo banco da
produção** (ver CONFIGURAR.md 3.2). Sem essa linha, tudo roda local (PGlite).

No Expo Go (Android) as notificações push não existem: o app abre normalmente e Configurações
mostra push como "indisponível". Push requer uma build nativa e configuração Firebase/EAS
(CONFIGURAR 3.13); não é necessário para testar widgets.

**Opção B — contra a produção, Android com widgets:** `npm run build:android` e instale
`build/android/bubo-test.apk` (CONFIGURAR.md 3.3). O Expo Go **não** consegue
entrar na conta da API de produção (ela só aceita o app oficial `bubo://`).

**Para testar a Comunidade** você precisa de **duas contas** (dois celulares, ou sair e entrar com
outra conta): uma cria o clube e escreve, a outra entra e vê o bloqueio anti-spoiler.

### Checklist geral (vale para toda tela)

- [ ] Tema claro e escuro (Você → Aparência).
- [ ] Fonte grande do sistema (1,6×): nada cortado, botões com texto inteiro.
- [ ] Tela pequena (ex.: 360 px de largura) e teclado aberto: campos e botões acessíveis.
- [ ] "Reduzir movimento" do sistema ligado: sem animações que girem ou fiquem em loop.
- [ ] TalkBack (Android) / VoiceOver (iPhone): cada botão diz o que faz.
- [ ] Modo avião: aparece o aviso de offline e os erros oferecem "Tentar de novo".
- [ ] Sem dados inventados: listas vazias mostram o Bubo e uma explicação honesta.

---

## 1. Entrada e conta

| #   | Tela                | Como chegar                                | O que conferir                                                                              |
| --- | ------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| 1   | Abertura (splash)   | Abrir o app                                | Símbolo oficial; some assim que a sessão carrega; sem barra de progresso falsa.             |
| 2   | Boas-vindas         | Primeiro acesso, sem conta                 | Mascote oficial, "Começar" (vai ao cadastro) e "Já tenho uma conta".                        |
| 3   | Cadastro            | Boas-vindas → Começar                      | Validação de nome, e-mail, senha (8+) e confirmação; e-mail repetido mostra mensagem clara. |
| 4   | Entrar              | Boas-vindas → Já tenho uma conta           | Senha errada → "E-mail ou senha incorretos"; 5 tentativas/min → aviso de espera.            |
| 5   | Esqueci minha senha | Entrar → Esqueci minha senha               | **Sem Resend:** mostra "serviço indisponível". **Com Resend:** o e-mail chega.              |
| 6   | Redefinir senha     | Link do e-mail (só com Resend configurado) | Abre o app, pede nova senha duas vezes, depois volta para Entrar.                           |
| 7   | Excluir conta       | Você → Excluir conta                       | Pede a senha; depois da exclusão volta para Boas-vindas e a conta não entra mais.           |

## 2. Onboarding (só na primeira vez, após o cadastro)

Antes, confira os emails de conta quando o domínio/Resend estiverem configurados (ADR-025):
cadastro recebe um único email de boas-vindas/confirmação; o link confirma e volta ao app sem
bloquear o uso inicial. Recuperação recebe link de 1 hora/uso único; senha redefinida recebe
aviso de segurança. Confira texto/imagens/botão no Gmail e outro cliente. Links `bubo:///`
podem exigir abrir o app manualmente. Sem Resend, ações de email em produção continuam 503.
Guia de ativação: [emails-dns.md](emails-dns.md).

| #   | Tela                 | O que conferir                                                  |
| --- | -------------------- | --------------------------------------------------------------- |
| 8   | Hábito (2/6)         | Barra de progresso "2 de 6"; só avança com uma opção escolhida. |
| 9   | Objetivo (3/6)       | Seleção múltipla; voltar mantém as escolhas.                    |
| 10  | Interesses (4/6)     | Chips de gêneros; seleção múltipla.                             |
| 11  | Primeiro livro (5/6) | Busca no catálogo, leitor de ISBN, entrada manual e "Pular".    |
| 12  | Concluído (6/6)      | Não promete XP; "Ir para o Bubo" abre a aba Hoje.               |

## 3. Abas principais

| #   | Tela           | O que conferir                                                                                                                                |
| --- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 13  | **Hoje**       | Sequência e XP reais no topo, sino com avisos não lidos; "Lendo agora"; "Recuperação ativa"; semana cognitiva; missão com a sua meta de foco. |
| 14  | **Estante**    | Livros agrupados por status; vazio mostra o Bubo; botão para adicionar.                                                                       |
| 15  | **Revisar**    | Cards de hoje (respeita o limite diário) e selo na aba; limite atingido → "Meta de revisões cumprida"; sem cards → explica como criar.        |
| 16  | **Comunidade** | Ver seção 6.                                                                                                                                  |
| 17  | **Você**       | Ver tela 47 (perfil novo). Aparência agora fica em Preferências.                                                                              |

## 4. Livros e leitura

| #   | Tela                      | Como chegar                                             | O que conferir                                                                                                           |
| --- | ------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 18  | Descobrir livros          | Estante → botão de bússola no topo                      | Temas por interesse; busca por título, autor ou ISBN; "Uma das bibliotecas não respondeu" quando o Google falha.         |
| 19  | Detalhe do catálogo       | Tocar num livro da busca                                | Edição, idioma, páginas; "Adicionar"; "Abrir na estante" se já estiver lá.                                               |
| 20  | Leitor de ISBN            | Botão de ISBN no campo de busca ou "Escanear ISBN"      | Pede permissão da câmera; lê o código de barras; ISBN manual como alternativa.                                           |
| 21  | Adicionar livro           | Estante → "+ Livro" (busca, ISBN ou "Adicionar manual") | Título obrigatório; páginas 1–20000.                                                                                     |
| 22  | Livro (Jornada literária) | Tocar num livro da Estante                              | Status, progresso, **Caminho de memória** (sessões, revisões e a próxima revisão), histórico de sessões, cards, remover. |
| 23  | Sessão de leitura focada  | Livro → Iniciar/Continuar leitura                       | Cronômetro; sair pede confirmação; ao fim: página alcançada + reflexão opcional.                                         |
| 24  | Resultado da sessão       | Fim da sessão                                           | Minutos, páginas, XP e sequência reais; a reflexão vira card para amanhã.                                                |

## 5. Memória e progresso

Continuação de 2026-09-30 — Você → Minha memória:

- Alternar 7, 30, 90 e 365 dias, inclusive rapidamente e sem conexão.
- Conferir carregamento, erro/retry e vazio de cada período, sem dados do filtro anterior.
- Rolar o histórico diário; conferir datas, autoavaliações e totais.
- Conferir foco mesmo sem revisões, horários locais e abrir cada livro listado.
- Revisar um card e voltar: dados devem atualizar; trocar conta não pode mostrar a anterior.
- Validar tema claro/escuro, fonte ampliada e leitor de tela em aparelho (aceite pendente).

| #   | Tela                 | Como chegar                | O que conferir                                                                                             |
| --- | -------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 25  | Revisão "sem espiar" | Revisar → Ainda lembro?    | Tentar → mostrar → Lembrei/Quase/Esqueci; falha ao salvar mantém o card; resumo no fim.                    |
| 26  | Minha memória        | Você → Minha memória       | 7/30/90/365 dias; gráfico, foco, horários, dados por livro; aviso de autoavaliações; vazio e retry.        |
| 27  | Mural de conquistas  | Você → Mural de conquistas | Nível pelo XP real; 13 conquistas; bloqueadas mostram progresso (ex.: 3/10); nenhuma é dada sem atividade. |

## 6. Comunidade (Tasks 07 e 08) — use duas contas: **A** e **B**

| #   | Tela                 | Como chegar                                                                                      | O que conferir                                                                                                                                                                                                                                                                                                                                      |
| --- | -------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 28  | Comunidade (aba)     | Aba Comunidade                                                                                   | Abas "Feed Geral / Seus Clubes / Descobrir". Sem clubes: card do Bubo "Clubes sem spoiler". Feed: chips dos seus clubes, "Radar dos clubes" (novos nas últimas 24 h), debates e enquetes dos seus clubes, cobertos se passam da sua página. Descobrir: busca, filtros (Na sua estante, Com meta semanal, Mais ativos), caixa "Recebeu um convite?". |
| 29  | Criar novo clube     | Comunidade → "+ Clube"                                                                           | Nome (3–60), proposta, ícone, livro **do catálogo** da sua Estante (livro manual não aparece), meta semanal, **público ou privado**. Limite de 5 clubes.                                                                                                                                                                                            |
| 30  | Clube                | Tocar num clube                                                                                  | **B (não membro):** perfil do clube (topo roxo, estatísticas, dica do Bubo com sua página) e "Entrar e aceitar as diretrizes"; ao entrar, o livro vai para a Estante dele. **Membro:** abas Debates & Fórum / Enquetes / Membros / Diretrizes. Menu ⋮: "Sobre o clube", sair (membro) ou excluir (criador).                                         |
| 31  | Novo debate          | Clube → "Novo tópico"                                                                            | Título, tipo de discussão, capítulo, página (com −10/−1/+1/+10), citação opcional, texto. Página maior que o livro é recusada. Página 0 = debate geral.                                                                                                                                                                                             |
| 32  | Debate               | Tocar num debate                                                                                 | Tipo e âncora (Cap./Pág.), citação, reações (Fez pensar, Novo ponto, Bom contraponto — não dá para reagir ao próprio). Respostas nunca têm página menor que o debate. Ações: Apagar (seu), Denunciar, Bloquear autor, e para o criador Remover/Restaurar.                                                                                           |
| 33  | Diretrizes do clube  | Clube → aba Diretrizes, ou "Ler as diretrizes" no perfil                                         | 4 regras, exemplo certo/errado, sua página atual, o criador como guardião, perguntas frequentes.                                                                                                                                                                                                                                                    |
| 34  | Leitores bloqueados  | Você → Leitores bloqueados                                                                       | Lista quem você bloqueou; "Desbloquear" faz o conteúdo voltar.                                                                                                                                                                                                                                                                                      |
| 35  | Nova enquete         | Clube → aba Enquetes → "Nova enquete"                                                            | Pergunta (5+ letras), 2 a 4 opções diferentes, 3 ou 7 dias, única ou múltipla, página de bloqueio. Ao lançar, abre a enquete.                                                                                                                                                                                                                       |
| 36  | Enquete & Resultados | Tocar numa enquete (feed ou aba Enquetes)                                                        | Antes de votar **não** aparecem percentuais. Votou → barras, % e votos; "Alterar meu voto". "Atualizado há Xs" enquanto aberta (atualiza a cada 15 s). Síntese do Bubo calculada dos votos. Argumentos: só depois de votar, um por pessoa, editável; reações; denunciar/bloquear/apagar.                                                            |
| 37  | Membros              | Clube → aba Membros                                                                              | Páginas reais de cada membro, média do clube, distribuição por faixa de páginas (a sua destacada), totais (páginas, discussões, votos), busca e filtros.                                                                                                                                                                                            |
| 38  | Convidar membros     | Clube → ícone de pessoa com "+" no topo, ou "Convidar amigos" no perfil                          | QR de verdade, código ABCD-2345, link com "Copiar", WhatsApp/Telegram/E-mail/Mais. Só o criador vê "Gerar novo código" (o antigo para de funcionar).                                                                                                                                                                                                |
| 39  | Abrir convite        | Link do convite, QR, ou Descobrir → "Recebeu um convite?"                                        | Mostra o perfil do clube (inclusive privado) e "Aceitar convite". Código errado/antigo: "Convite expirado". Se você já é membro, vai direto ao clube.                                                                                                                                                                                               |
| 40  | Avaliar & Resenhar   | Clube → aba Resenhas → "Escrever resenha", ou Estante → livro do catálogo → "Avaliar & resenhar" | Estrelas de 1 a 5 com legenda, até 3 marcas em "Como essa leitura reverberou?", título (3+), texto (30+) com contagem de palavras. Proteção anti-spoiler: desligada = página 0; ligada = "Até o meio", "Até onde li", "Final / desfecho" ou página exata. "Onde compartilhar" mostra só o clube.                                                    |
| 41  | Resenha              | Tocar numa resenha (aba Resenhas ou feed)                                                        | Autor com nível e botão "Amizade" (ou "Pedido enviado"/"Amigos"), estrelas, marcas, véu se a página passa da sua, respostas como num debate. Denunciar, bloquear, apagar e moderação iguais aos debates.                                                                                                                                            |
| 42  | Feed de amigos       | Comunidade → ícone de pessoas no topo                                                            | Abas Atividade / Amigos / Privacidade. Atividade: "Lendo agora" (livro em andamento e % de quem compartilha) e sessões recentes (minutos e páginas, nunca reflexões). Amigos: pedidos recebidos (Aceitar/Recusar), amigos e pedidos enviados, com desfazer e bloquear. Privacidade: receber pedidos e compartilhar leituras (desligado por padrão). |
| 43  | Ciclos do clube      | Clube → linha "Ciclos & leituras anteriores" abaixo do livro                                     | Bubo historiador, totais reais (concluídos, % na meta, páginas), filtro por ano, ciclo atual com dias restantes e progresso do grupo e o seu, linha do tempo dos encerrados. Só o criador abre (páginas por pessoa + 7/14/30/60/90 dias) e encerra.                                                                                                 |
| 44  | Moderação geral      | Você → Moderação geral (só contas em `MODERATOR_USER_IDS`)                                       | Fila de denúncias abertas de todos os clubes com motivos e contagem. Textos só aparecem com "Mostrar textos denunciados". "Remover" e "Manter" resolvem as denúncias. Para outras contas, a entrada não aparece e a API responde 403.                                                                                                               |

### Roteiro de convite e clube privado

1. **A** cria um clube **privado** → **B** procura em Descobrir: o clube **não** aparece.
2. **A** abre "Convidar membros" → copia o código (ou compartilha o link).
3. **B** digita o código em Descobrir → "Recebeu um convite?" → vê o perfil → "Aceitar convite" →
   entra no clube.
4. **A** toca "Gerar novo código" → **B** (ou uma conta C) tenta o código antigo → "Convite
   expirado".
5. No aparelho com o app instalado (build EAS), a câmera lendo o QR abre o convite direto. No Expo
   Go o link é `exp://…` e só funciona na mesma rede do computador.

### Roteiro de enquete

1. **A** cria uma enquete na página 0 com 2 opções. **B** abre: sem percentuais até votar.
2. **B** vota → vê 100% na opção dele → escreve um argumento → **A** reage "Fez pensar" → o
   contador sobe.
3. **A** cria outra enquete na página 100 → para **B** (página 0) ela aparece coberta, sem a
   pergunta, com "Revelar".

### Roteiro anti-spoiler (o teste mais importante da Comunidade)

1. **A** adiciona um livro do catálogo com número de páginas, cria um clube com ele e abre um
   debate na **página 100**.
2. **B** entra no clube (página 0). O debate aparece como **"Contém spoiler da página 100 — faltam
   100 páginas"**, sem título nem texto.
3. **B** toca em "Quero espiar mesmo assim" → o texto aparece só nessa tela.
4. **B** vai na Estante → livro → atualiza para a página 100 → volta ao clube: o debate agora
   aparece normal.
5. **B** responde com página 0 → a resposta fica marcada "Pág. 100" (herda a página do debate).

### Roteiro de resenha

1. **A** abre o clube → aba Resenhas → "Escrever resenha" → 5 estrelas, marcas "Profundo &
   reflexivo" e "Final arrebatador", liga a proteção e escolhe "Final / desfecho" → publica.
2. **B** (página 0) vê a resenha coberta: sem título, nota nem marcas. "Quero espiar" mostra tudo
   só naquela tela.
3. Tente publicar com texto curto (menos de 30 caracteres): aparece o aviso e nada é enviado.

### Roteiro de amigos

1. **B** abre a resenha de **A** → "Amizade" → aparece "Pedido enviado".
2. **A** → Comunidade → ícone de pessoas → aba Amigos → "Aceitar".
3. **B** → Atividade: vazio, porque **A** ainda não compartilha.
4. **A** → Privacidade → liga "Compartilhar minhas leituras" → faz uma sessão de leitura.
5. **B** → Atividade: aparece **A** em "Lendo agora" e a sessão (minutos e páginas). A reflexão
   escrita por **A** **não** aparece.
6. **A** desliga o compartilhamento → tudo some para **B** na hora.

### Roteiro de ciclos

1. **A** (criador) → clube → "Ciclos & leituras anteriores" → meta de 20 páginas, 7 dias →
   "Iniciar ciclo".
2. **B** abre a mesma tela: ciclo atual com dias restantes; depois de uma sessão no livro do
   clube, o progresso do grupo e o dele sobem.
3. **B** não vê "Iniciar ciclo" nem "Encerrar ciclo". **A** encerra → o ciclo vai para a linha do
   tempo com "X de Y na meta".

### Roteiro de moderação

1. **B** denuncia o debate de **A** (motivo "Spam") → o debate some para **B** na hora.
2. **A** (criador) vê o selo "1 denúncia" no debate → toca em "Restaurar" → o selo some.
3. Com 3 contas denunciando o mesmo item, ele fica oculto para todos, menos para o autor e o
   criador (aparece "Oculto por denúncias").
4. **B** abre um debate de **A** → "Bloquear autor" → tudo de **A** some para **B** em todos os
   clubes → Você → Leitores bloqueados → "Desbloquear" → volta a aparecer.
5. **A** apaga o próprio debate → some para todos. **A** exclui o clube → **B** vê "Clube não
   encontrado".

---

## 6b. Você, preferências e notificações (Task 09)

| #   | Tela                    | Como chegar                                                  | O que conferir                                                                                                                                                                                                                                                                        |
| --- | ----------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 45  | Preferências cognitivas | Você → engrenagem no topo, ou Você → Preferências cognitivas | Rigor (Suave / Equilibrado / Intensivo), revisões por dia (5–50), meta diária de foco, meta anual, tema (salvo ao reabrir o app), vibração, notificações (estado do aparelho, lembrete + horário, clubes, amigos), escudo anti-spoiler sempre ligado. "Salvar" só ativa com mudanças. |
| 46  | Notificações            | Sino no topo do Hoje ou do Você                              | Todas / Memória / Comunidade; card "Hora de revisar" só com lembranças vencidas; avisos por dia; aceitar/recusar amizade ali mesmo; "Lidas" zera o contador do sino.                                                                                                                  |
| 47  | Você (novo)             | Aba Você                                                     | Avatar com estrela, nível e XP para o próximo nível, livros lidos / Lembrei 30 dias / sequência, conquistas recentes, meta anual, seu jeito de ler, atalhos.                                                                                                                          |

### Roteiro de preferências

1. Em Preferências, escolha **Intensivo**, **5** revisões por dia e **30 min** → Salvar.
2. Hoje: a missão vira "Leia 30 minutos com foco hoje", com barra de progresso.
3. Revisar: aparecem no máximo 5 cartões; ao terminar os 5, aparece "Meta de revisões cumprida".
4. Troque o tema para **Escuro**, feche o app de vez e abra de novo: continua escuro.

### Roteiro de notificações (duas contas, A e B, no mesmo clube)

1. **B** pede amizade a **A** → o sino de **A** mostra 1 → Notificações → "Aceitar".
2. **B** recebe "Amizade aceita". **A** abre um debate; **B** responde → **A** vê "B respondeu à
   sua discussão" (sem o texto da resposta) → "Ver discussão" abre o debate.
3. Com uma build instalada (CONFIGURAR 3.13) e o lembrete ligado para a próxima hora cheia, com
   cartões vencidos: chega "Hora de lembrar"; tocar abre Revisar. No Android, em Configurações →
   Apps → Bubo → Notificações, aparecem os canais "Lembretes de revisão" e "Comunidade".
4. **Android:** em telas com campo de texto no rodapé (responder debate, publicar resenha), o
   teclado não pode cobrir o campo nem o botão.

---

## 6c. Widgets Android e iOS (Task 09, ADR-023 / ADR-026)

Abra **Você → Bubo na sua tela**. Sem módulo nativo, confira as prévias; os widgets do sistema
precisam de uma nova build instalada (CONFIGURAR 3.14).

Para o APK Android gratuito: `npm run build:android`, depois copie `build/android/bubo-test.apk`
para o celular ou rode `npm run install:android` com USB autorizado. Feche o terminal/Metro e
confira que o app continua abrindo e os widgets aparecem no seletor do launcher.

1. **Android:** adicione os quatro modelos (Sequência, Sequência da semana, Calendário de
   leitura, Continuar leitura) pelo botão no app ou pelo seletor Widgets → Bubo. Compare com
   as prévias do app: cena colorida de ponta a ponta, chama + número, frase e Bubo espiando de
   baixo sem distorção. Redimensione: os médios estreitos viram o pequeno. **iOS:** confira
   pequeno/médio e as três variantes de Sequência na tela bloqueada.
   Widgets do modelo anterior (Ritmo da semana / Bubo completo) devem sumir após a atualização.
2. Sem livro em leitura: estado vazio, sem capa/título/percentual inventados. Com um livro:
   widget mostra a página real; toque abre livro/sessão autenticados. Confirme que a sessão
   não começa a registrar atividade apenas por instalar/tocar no widget.
3. Conclua uma sessão: a chama acende (laranja), a cena fica dourada com o Bubo comemorando,
   o dia ganha check na semana e entra na faixa do calendário (fundo menta). Página/progresso
   atualizam. Um dia só de revisão também acende a chama (“Revisão feita hoje!”), mas não
   conta para a meta semanal de leitura; ao bater a meta, aparece “Meta da semana!”.
4. Revise até o limite diário: a contagem de revisões oferecidas cai a zero, mesmo que existam
   outros cards pendentes. O widget não deve insistir em revisões que o app já limitou.
5. No iPhone, o título da tela bloqueada começa oculto; capa, reflexão e resposta de memória
   não aparecem. Altere a opção no app e confira; as regras de privacidade do sistema prevalecem.
6. Desligue “Atualizar meus widgets”: os dados somem. Ligue: dados da conta atual voltam.
   Saia da conta, entre com outra e exclua uma conta de teste: widgets anteriores não podem
   ressurgir, inclusive se uma capa ainda estava carregando.
7. Sem ler hoje e com sequência: às 18h “Salve sua sequência!” (com “!” vermelho na chama),
   às 21h “Está ficando tarde!”, às 22h “Última chance!”. Sem sequência, não há alerta.
   Depois de ler, à noite (22h–05h59) o Bubo dorme. Após virar o dia / dados ficarem antigos,
   o widget mostra “Abra o Bubo” sem número e não mantém números de “hoje”. Sem conexão, reabrir não renova dados antigos.
   O sistema pode atrasar refresh; sincronize abrindo o app para conferir a atualização imediata.
8. Confira tema claro/escuro do sistema, fonte grande, TalkBack/VoiceOver, ações e labels.
   Android específico de tela bloqueada e Live Activity não fazem parte deste recorte.

**APK Android compilado e verificado em 2026-10-01** (assinatura, três receptores de widgets
e bundle embarcado). **Aceite em aparelho ainda pendente:** não houve celular conectado.
Swift/iOS ainda não foi compilado; o comportamento do launcher/WidgetKit exige este roteiro.

## 7. Só em desenvolvimento

| Tela                     | Como chegar                  | Observação                                                |
| ------------------------ | ---------------------------- | --------------------------------------------------------- |
| Vitrine do design system | Você → "DEV · Design system" | Só aparece em modo desenvolvimento; usa dados de exemplo. |
| Página não encontrada    | Link inválido                | Mostra o Bubo e um caminho de volta.                      |

## 8. O que ainda não existe (não é defeito)

- Comunidade: convites para leitores específicos, sugestões de amigos, rascunho de resenha e
  feed público de resenhas. Os avisos de respostas/ciclos e a caixa de notificações já existem.
- Curva de retenção e Bubo Score.
- Login com Google/Apple, verificação de e-mail, exportação de dados e recursos de IA.
- Push no aparelho ainda depende de EAS/Firebase/Apple; widgets dependem de uma nova build nativa.
- Live Activity de sessão e widget Android específico de tela bloqueada.
