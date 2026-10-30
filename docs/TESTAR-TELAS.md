# Roteiro de testes — todas as telas do Bubo

Lista de **todas as telas que existem hoje**, como chegar em cada uma e o que conferir. Use quando
terminar as configurações de [../CONFIGURAR.md](../CONFIGURAR.md). Status de cada tela frente ao
Stitch: [screens.md](screens.md).

Última atualização: 2026-10-04 (retomada, Hoje adaptativo, Replay mensal/anual e Stories).
O roteiro inclui Widgets, Liga semanal, Replay e Stories, além das telas de desenvolvimento.

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

- [ ] Tema claro e escuro (Você → Preferências → Tema).
- [ ] Fonte grande do sistema (1,6×): nada cortado, botões com texto inteiro.
- [ ] Tela pequena (ex.: 360 px de largura) e teclado aberto: campos e botões acessíveis.
- [ ] "Reduzir movimento" do sistema ligado: sem animações que girem ou fiquem em loop.
- [ ] TalkBack (Android) / VoiceOver (iPhone): cada botão diz o que faz.
- [ ] Modo avião: aparece o aviso de offline e os erros oferecem "Tentar de novo".
- [ ] Sem dados inventados: listas vazias mostram o Bubo e uma explicação honesta.
- [ ] Cabeçalho padrão (ADR-047): nas abas, título grande à esquerda, até dois botões redondos e
      o avatar (menos em Você); nas telas internas, voltar/fechar, título à esquerda e, quando
      houver, uma linha de contexto embaixo (nome do clube, "Lembrança 2 de 5"). Barra inferior
      com ícone e nome em todas as abas ("Comunidade" inteiro em 360 px).

---

## 1. Entrada e conta

| #   | Tela                | Como chegar                                              | O que conferir                                                                                                                                                                                                                                                                                                                                                               |
| --- | ------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Abertura (splash)   | Abrir o app                                              | Símbolo oficial; some assim que a sessão carrega; sem barra de progresso falsa.                                                                                                                                                                                                                                                                                              |
| 2   | Boas-vindas         | Primeiro acesso, sem conta                               | Mascote oficial, "Começar" (vai ao cadastro) e "Já tenho uma conta".                                                                                                                                                                                                                                                                                                         |
| 3   | Cadastro            | Boas-vindas → Começar                                    | Validação de nome, e-mail, senha (8+) e confirmação; e-mail repetido mostra mensagem clara.                                                                                                                                                                                                                                                                                  |
| 4   | Entrar              | Boas-vindas → Já tenho uma conta                         | Senha errada → "E-mail ou senha incorretos"; 5 tentativas/min → aviso de espera. **Com Resend:** senha certa em aparelho novo abre a tela de código (5). **Sem Resend:** entra direto.                                                                                                                                                                                       |
| 5   | Código de entrada   | Entrar (senha certa, aparelho não lembrado)              | O e-mail "482913 é o seu código…" chega com o Bubo; 6 células; código errado → mensagem; certo → Hoje. "Lembrar este aparelho" ligado: sair e entrar de novo não pede código. "Reenviar" só após 60 s.                                                                                                                                                                       |
| 6   | Esqueci minha senha | Entrar → Esqueci minha senha                             | **Sem Resend:** "serviço indisponível". **Com Resend:** chega o código; na mesma tela digite o código e a senha nova (2×); ao salvar você **já entra** no app (sem segundo código) e o e-mail "Senha alterada" chega. Saia e entre com a senha nova: funciona (aparelho novo pede o código de entrada, que é outro). Build antigo: "Algo deu errado" em vez de ficar parado. |
| 7   | Redefinir senha     | Link de e-mail antigo (builds anteriores)                | Abre o app, pede nova senha duas vezes; ao salvar você já está dentro ("Continuar").                                                                                                                                                                                                                                                                                         |
| 7b  | Excluir conta       | Você → Configurações → Conta e segurança → Excluir conta | Pede a senha; depois da exclusão volta para Boas-vindas, a conta não entra mais e o e-mail "Sua conta no Bubo foi excluída" chega.                                                                                                                                                                                                                                           |

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

| #   | Tela           | O que conferir                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13  | **Hoje**       | (ADR-043) Palco no topo com a capa do livro atual desfocada (troque de livro e as cores mudam; sem capa usa a cor da capa tipográfica; sem livro, roxo); barra de status clara; símbolo, sequência, XP, sino e avatar (abre Você); "Boa noite, Nome" numa linha; livro 3D (toque gira), toque no título abre o livro; trilha dourada com "faltam N pág. pra metade"; um botão branco "Continuar leitura" + "5 min"; blocos Meta (anel), Sequência (laranja) e Revisar (verde); cartela; "Pra você hoje" só com recomendação real; "Amigos lendo" só com amigos que compartilham; Replay. Roteiro ADR-032 abaixo; aceite em aparelho pendente. |
| 13b | **Barra e +**  | Barra flutuante arredondada na largura toda: Hoje, Estante, +, Revisar (com contador real), Comunidade; conteúdo não fica escondido atrás dela. O + abre Ações rápidas só com ações possíveis (continuar, 5 min, adicionar, escanear, buscar, revisar, atualizar página). Você só pelo avatar no topo.                                                                                                                                                                                                                                                                                                                                        |
| 14  | **Estante**    | (ADR-046) Uma vez por dia, com livros: corredor com seus livros em perspectiva, símbolo do Bubo no centro, "Sua estante" com livros e páginas reais e "Abrir minha estante". Depois: cabeçalho "Estante" com 3D, + e avatar (ADR-047), busca em largura total; círculos Lendo/Quero ler/Lidos/Favoritos/Tenho/Abandonei (Desejados e Pausados quando houver) com contagem real abrem a prateleira; Continuar lendo; coleções (Lidos no ano, Quero ler com curtinhos, Favoritos); Adicionados recentemente; "Ver todos" abre a grade com filtros, busca e ordenação.                                                                           |
| 15  | **Revisar**    | (ADR-045/047) Cabeçalho "Revisar" / "Hora de lembrar" com avatar. Pilha de cards de hoje com o primeiro card real e "Revisar N cards · ~M min · até +X XP" (respeita o limite diário); limite atingido → "Meta de revisões cumprida"; sem cards → explica como criar. Cartela do dia com carimbos reais (meta de leitura, lembrança, revisão), selo "2/3"/"fechada!" e "renova em Nh"; carimbo aberto abre a atividade. Desafio do mês (20 dias ativos) com a grade do mês. Treinos: "Cards que escaparam" (marcados como esqueci em 30 dias) e "Relâmpago de 60s"; não mudam agenda nem XP.                                                  |
| 16  | **Comunidade** | Ver seção 6.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 17  | **Você**       | Ver tela 47 (perfil novo). Aparência agora fica em Preferências.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

Textos enxutos (2026-10-03): confirme que o card explicativo no fim de Hoje foi removido, que as
opções de Você se chamam **Preferências** e **Widgets**, e que instruções de ação, consentimento
Gemini, privacidade, anti-spoiler e erros continuam legíveis. Confira também os labels de Estante,
Revisar, Comunidade, Minha memória, sessão/resultado, Notificações, debate, Nova resenha e Nova enquete.
Aceite em aparelho continua pendente; checks de código e compilação não substituem este roteiro.

Boas-vindas deve mostrar **Leitura / Lembrar / Revisão**, sem prometer retenção permanente.
Login mantém os campos, recuperação de senha e erros, com os parágrafos repetidos removidos.

No passe de 2026-10-03, login real, Hoje sem o card final, Você, Preferências, cinco prévias de widgets e
Minha memória vazia em 7/30/90/365 dias foram conferidos no emulador Android com a fonte atual
via Metro. Sem erro de execução observado; conta temporária apagada depois. A nova build ARM64/ARMv7
foi compilada separadamente, sem instalação física. Fontes ampliadas, TalkBack e widgets no launcher
continuam no roteiro de aceite abaixo.

## 4. Livros e leitura

| #   | Tela                      | Como chegar                                        | O que conferir                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 18  | Descobrir livros          | Estante → barra de busca no topo                   | "Para você" com motivo em cada livro ("Mesma autoria de…", "Ficção científica, como…"), "Porque você leu X", "Mais lidos no Bubo" (só com 2+ leitores) e "Mais lidos em português"; nada que já está na estante; gêneros só com edições em português. Enquanto carrega: blocos neutros (sem capa falsa). Busca rápida digitando sem "catálogo indisponível".                                                                                                                                           |
| 19  | Detalhe do catálogo       | Tocar num livro da busca                           | Edição, idioma, páginas; "Adicionar"; "Abrir na estante" se já estiver lá.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 20  | Leitor de ISBN            | Botão de ISBN no campo de busca ou "Escanear ISBN" | Pede permissão da câmera; lê o código de barras; ISBN manual como alternativa.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 21  | Adicionar livro           | Estante → "+" (busca, Ler ISBN ou Cadastrar à mão) | Resultados em linhas compactas; o "+" abre Quero ler / Lendo / Já li e adiciona sem sair da lista (vira ✓). Manual: título obrigatório; páginas 1–20000.                                                                                                                                                                                                                                                                                                                                               |
| 22  | Livro (Jornada literária) | Tocar num livro da Estante                         | **Livro 3D** no topo com a capa desfocada; nota dos leitores (só com 5+ avaliações) e "Leitores no Bubo" (2+ leitores), sem nomes; status Quero ler/Lendo/Lido/Relendo (pede confirmação e volta à página 0)/Pausado/Abandonei; Favorito/Tenho/Desejado; progresso com previsão de término (2+ sessões em 14 dias); Sua nota + Nota dos leitores; abas Leitura/Sobre/Resenhas/Cards; "Quem leu também leu" (3+ leitores) abre o catálogo.                                                              |
| 22b | Estante 3D                | Estante → ícone de prateleiras no topo             | Estante de madeira com todos os livros reais: lombadas mais grossas em livros longos, livros "Lendo" de frente com a capa real, Bubo sentado em cima. Tocar num livro o ergue e abre o holofote com capa 3D, título, autor, status, nota e páginas; "Abrir livro" leva à tela normal; "Devolver à estante" ou tocar fora fecha. Estante vazia mostra o Bubo e "Adicionar livro". Nada muda de dados.                                                                                                   |
| 23  | Sessão de leitura focada  | Livro → Iniciar/Continuar leitura                  | (ADR-044) Tela noturna: livro 3D com fita marcadora que desce com o tempo, Bubo lendo, relógio grande, uma folha dourada por minuto até a meta (5 min, o que falta da meta do dia ou 10), "+N XP até agora"; parado mostra "Antes de voltar" com página/anotação real e pergunta opcional. "Terminei por hoje" (a partir de 1 min) pausa e abre "Até que página você foi?" (−/+, digitar, +5, +10, próximo quarto do livro); fechar a folha retoma. Descartar aparece pausado. Roteiro ADR-032 abaixo. |
| 24  | Ficha, recibo e sequência | Fim da sessão                                      | Ficha pautada com abas Ideia/Detalhe/Conexão e letra à mão; "Guardar na memória" carimba GUARDADO só com resposta própria e sem repetir (senão o Bubo dá uma dica); "Ver meu recibo de leitura" confere no servidor e salva. Recibo impresso só após aceite da API: páginas, foco, 3 de 3, XP real, sequência, marco. Se a sequência cresceu, segue para "dias seguidos" (calendário do mês, proteções, marcos). Hoje → bloco Sequência abre a mesma tela.                                             |

### Estante, busca e livro estilo Skoob (ADR-042, 2026-10-13)

1. Estante: a barra "Buscar livros, autores ou ISBN" abre o Descobrir já com o teclado. Os
   contadores (Todos, Lendo, Quero ler, Lidos; Pausados/Abandonados só se houver) filtram a grade.
   "Lendo agora" aparece em Todos com a página real. Grade de 3 colunas: marca de status no canto,
   barra de progresso na capa de quem está lendo, estrelas da sua nota. Ordenar por "Sua nota".
2. Busca (Descobrir ou "+"): linhas compactas com ano · páginas · idioma; "+" abre Quero ler /
   Lendo / Já li e o livro entra sem sair da lista (o botão vira ✓ e abre o livro). "Não achou?"
   leva ao cadastro manual.
3. Descobrir sem busca: chips de gênero, carrosséis de capas com "+" no canto e o motivo real.
   Abrir o Descobrir alguns segundos depois de abrir a Estante já mostra as prateleiras.
4. Livro do catálogo: capa desfocada ao fundo, livro 3D, colunas Páginas/Ano/Idioma, sinopse com
   "Ler mais", três botões Quero ler / Lendo / Já li (um toque adiciona e abre o livro).
5. Livro da estante: abre sem spinner; status, cartão de progresso com folha (+10/+25/+50/Última
   página), abas Leitura / Sobre / Cards; "⋮" → story ou remover. Confira tema escuro, fonte 1,6× e
   TalkBack/VoiceOver nos botões "+".

### Busca e Estante (ADR-033, 2026-10-04)

1. Em Estante, toque **Adicionar livro**, escolha **Já li**, busque título/autor e adicione dois
   livros sem sair dos resultados. Cada botão vira **Abrir estante** após salvar.
2. Abra os detalhes antes de adicionar: a escolha **Já li** deve continuar selecionada. Repita
   por ISBN e pelo formulário manual, com e sem número de páginas.
3. Volte à Estante: confira **Lidos**, contagem, busca sem acentos, ordenação por título/autor,
   limpar filtros e atualização ao puxar. Altere Lendo/Já li na própria lista e veja o detalhe.
4. Em Descobrir, digite até passar de 2 para 3 letras e continue digitando/apagando. O foco e o
   teclado devem permanecer; os resultados anteriores ficam visíveis até chegarem os novos (ADR-042)
   e o "+" sempre confirma o livro (capa e título) na folha antes de adicionar. O campo de busca
   fica acessível durante a rolagem.
5. Confira capas na primeira visita e ao voltar: quadro neutro durante carga, capa real sem flash
   tipográfico, alternativa quando uma imagem falha/demora. Role muitos resultados sem travamento.
6. Teste uma biblioteca lenta, rede interrompida e retry. Resultados parciais devem ser identificados;
   uma falha não deve parecer "Nenhum livro encontrado". Dados conhecidos só sobrevivem a falhas
   recuperáveis; sessão expirada e livro confirmado ausente prevalecem.
7. Marcar um livro antigo como **Já li** não aumenta XP, sequência, sessões ou minutos. Confira
   fontes grandes, tela pequena, tema escuro e TalkBack/VoiceOver, incluindo nomes dos status.

Aceite visual/em aparelho desta melhoria permanece pendente. O app instalado só recebe o novo
fluxo com uma atualização; a inclusão direta em Já li requer a API atualizada.

### Hoje adaptativo (ADR-032, 2026-10-04)

Este é o roteiro de aceite da nova continuação. `npm run verify` passou (495 testes), com
formato/lint/tipos/assets/audit verdes. Não houve execução visual/aparelho atual; o roteiro
permanece pendente. Use uma conta de teste e registros reais; não altere o histórico de uma
conta pessoal para forçar estados.

1. Com uma sessão guardada, Hoje oferece retomá-la mesmo havendo revisões. Ao abrir, UUID,
   tempo, campos e envio pendente continuam. Sem rascunho, carregamento não deve parecer estante
   vazia; falha de dados apresenta **Tentar de novo**.
2. Com cards oferecidos hoje, a ação principal é revisar. Ao atingir o limite diário, Hoje deixa
   de insistir nesses cards. Sem cards oferecidos, não há card de Revisões vazio ocupando espaço.
3. Com livro em leitura e última sessão real em data local de sete ou mais dias atrás, a ação
   principal oferece cinco minutos. Com seis dias, não deve alegar afastamento. Uma conta sem
   sessões não recebe afirmação de tempo longe. Visitar o app, atualizar página ou revisar não
   substitui uma leitura aceita.
4. Depois de salvar leitura hoje, o convite passa a continuar; sem livro em leitura, aparece
   escolha de livro. Em conflito com revisões disponíveis, revisar mantém prioridade. O livro
   atual, Sua semana e a missão continuam com valores reais.
5. Confira tema claro/escuro, fonte grande, TalkBack/VoiceOver e retorno à tela após virar a data
   local. Datas de leituras antigas mantêm o dia local salvo na sessão mesmo após mudar o fuso.

### Antes de voltar, cinco minutos e recuperação (ADR-032)

1. Hoje → continuar livro, ou Livro → iniciar leitura: antes do timer, **Antes de voltar** mostra
   página atual e a última anotação/recordação disponível nas 20 sessões recentes reais. Confira
   resumo de até três linhas, **Ver anotação completa** e **Recolher anotação**. Sem anotação,
   mostra estado honesto. Com livro real em cache e histórico carregando/falha temporária, é
   possível começar sem esperar; erro de autenticação ou livro removido não é ignorado pelo cache.
   **Tentar lembrar** abre a pergunta “O que você lembra do trecho anterior?”; pense sem digitar.
   **Começar agora** / **Pular e começar** inicia sem resposta obrigatória ou envio à IA.
2. **Ler só 5 minutos** inicia a sessão normal. Pause por um minuto: o tempo pausado não compõe
   a meta. Ao alcançar cinco minutos focados, confira o aviso leve; o cronômetro continua e
   Recordação segue disponível. Você pode ler além de cinco minutos ou encerrar antes, respeitando
   o mínimo normal de um minuto e a recordação obrigatória.
3. Feche/encerre o app e reinicie o aparelho antes e depois dos cinco minutos. Retome: tempo,
   meta, campos e UUID preservados; o aviso não dispara novamente como uma nova conquista.
   Abra uma sessão normal guardada pelo atalho de cinco minutos: sua meta anterior não muda.
   Nenhum tempo guardado gera XP/página/card antes do aceite da API.
4. Desconecte a rede, escreva a recordação e tente concluir: mantenha o rascunho, reconecte e
   confirme o mesmo envio. A sessão/XP/card deve existir uma única vez. Confira também pausa,
   relógio alterado, limite de quatro horas e descarte sem atividade.
5. Numa conta de teste, guarde uma sessão e remova o livro da Estante. Retome: ausência confirmada
   oferece descarte do registro local correspondente. Cancele: ele permanece. Confirme: Hoje
   deixa de oferecer aquela retomada. Em erro de rede, somente retry; não apagar o rascunho.
6. Fonte grande e leitor de tela: página, pergunta, aviso, erros e ações continuam alcançáveis.
   O aviso de meta é no app; não esperar push, Live Activity ou notificação em segundo plano.

### Recordação obrigatória (ADR-027)

1. Leia por pelo menos um minuto, toque **Terminei por hoje** e escolha a página. Feche o livro e
   responda ideia, detalhe e conexão (uma aba por vez). Campo vazio, texto repetido e respostas
   genéricas não recebem o carimbo e mostram uma dica do Bubo; página, XP e sequência não mudam.
2. Uma tentativa específica e curta deve passar; teste também bullets, ausência de acentos,
   dúvida sincera e poema. O resultado identifica a conferência de escrita, sem prometer compreensão
   ou retenção e sem apresentar uma nota de memória.
3. Edite uma resposta carimbada: o carimbo some e é preciso guardar de novo. Durante a conferência
   final, campos, consentimento e descarte ficam bloqueados, inclusive com armazenamento lento.
4. A opção de IA começa desligada. Só ligue com texto de teste sem dados pessoais. Sem chave,
   quota ou conexão com o provedor, a pergunta extra pode faltar e o checklist local permanece.
5. Feche o app antes de conferir e após um envio sem resposta. Recuperar mantém campos, página
   e UUID. Repetir um envio recebido não duplica sessão, XP ou card. Confira notas antigas inteiras.
6. Desconecte a rede: nenhuma conclusão fictícia; rascunho preservado. Ao reconectar, confirme o
   mesmo envio. Se a limpeza local falhar depois do aceite, a tela informa **sessão salva**.
7. Confira amanhã em Revisar: as três âncoras estão no card e continuam privadas. Em fonte grande,
   TalkBack/VoiceOver e teclado aberto, todos os campos e botões devem ser alcançáveis.

## 5. Memória e progresso

Continuação de 2026-10-03 — Você → Minha memória (ADR-030):

- Alternar 7, 30, 90 e 365 dias, inclusive rapidamente e sem conexão.
- Conferir carregamento, erro/retry e vazio de cada período, sem dados do filtro anterior.
- Rolar o histórico diário; conferir datas, autoavaliações e totais.
- Conferir foco mesmo sem revisões, horários locais e abrir cada livro listado.
- Revisar um card e voltar: dados devem atualizar; trocar conta não pode mostrar a anterior.
- Conferir **Lembrei após um intervalo** nas faixas **1–6 dias**, **7–29 dias** e **30+ dias**:
  cada percentual vem com **Lembrei/total**, por exemplo uma contagem `2/3` junto do percentual.
  O intervalo usa o tempo real desde a revisão anterior do card, ou desde sua criação na primeira
  revisão; tentativas com menos de 24 horas não entram nessa seção.
- Faixa sem observações mostra **Sem revisões**, sem barra ou `0%` inferido. Se nenhuma faixa
  tiver observações no período, a seção inteira fica oculta. Em conta nova, não aparece resultado
  de memória inventado. Não há curva preditiva nem Bubo Score.
- Validar tema claro/escuro, fonte ampliada e leitor de tela em aparelho (aceite pendente).

| #   | Tela                 | Como chegar                | O que conferir                                                                                                                                                                              |
| --- | -------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 25  | Revisão "sem espiar" | Revisar → Revisar          | Tentar → mostrar → Lembrei/Quase/Esqueci; falha ao salvar mantém o card; resumo no fim com a cartela do dia já carimbada. Treinos: Revisar → bloco de treino; virar e contar, nada é salvo. |
| 26  | Minha memória        | Você → Minha memória       | 7/30/90/365 dias; gráfico, foco, horários, livros; Lembrei após um intervalo com contagem e percentual; vazio e retry.                                                                      |
| 27  | Mural de conquistas  | Você → Mural de conquistas | Nível pelo XP real; 13 conquistas; bloqueadas mostram progresso (ex.: 3/10); nenhuma é dada sem atividade.                                                                                  |

## 6. Comunidade (Tasks 07 e 08) — use duas contas: **A** e **B**

| #   | Tela                 | Como chegar                                                                                      | O que conferir                                                                                                                                                                                                                                                                                                                                      |
| --- | -------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 28  | Comunidade (aba)     | Aba Comunidade                                                                                   | Abas "Novidades / Meus clubes / Descobrir". Sem clubes: card do Bubo "Clubes sem spoiler". Novidades: chips dos seus clubes, contagem de novidades em 24 h, debates e enquetes cobertos além da sua página. Descobrir: busca, filtros (Na sua estante, Com meta semanal, Mais ativos), caixa "Recebeu um convite?".                                 |
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
| 40  | Nova resenha         | Clube → aba Resenhas → "Escrever resenha", ou Estante → livro do catálogo → "Avaliar & resenhar" | Estrelas de 1 a 5 com legenda, até 3 marcas em "Como foi a leitura?", título (3+), texto (30+) com contagem de palavras. Proteção anti-spoiler: desligada = página 0; ligada = "Até o meio", "Até onde li", "Final / desfecho" ou página exata. "Onde compartilhar" mostra só o clube.                                                              |
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

| #   | Tela                 | Como chegar                                        | O que conferir                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | -------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 45  | Configurações        | Você → engrenagem no topo, ou Você → Configurações | Hub com seis entradas (ADR-039). **Revisões e leitura:** ritmo (Suave / Equilibrado / Intensivo), revisões por dia (5–50), foco diário, meta anual; "Salvar" só ativa com mudanças. **Notificações no celular:** estado do aparelho, lembrete + horário, clubes, amigos. **E-mails do Bubo:** "Lembretes de leitura" liga/desliga; e-mails da conta aparecem travados. **Aparência e toque:** tema (salvo ao reabrir o app) e vibração, sem botão salvar. **Widgets.** **Conta e segurança:** ver 48. **Sobre:** Termos, Privacidade, contato (só com `EXPO_PUBLIC_SUPPORT_EMAIL`) e versão. Anti-spoiler sempre ativo. |
| 48  | Conta e segurança    | Configurações → Conta e segurança                  | "Pedir código ao entrar" ligado por padrão (travado com aviso quando a API não envia e-mails); desligar/ligar pede a senha. Alterar senha (senha atual + nova 2×) → aviso de sucesso, outros aparelhos saem e o e-mail "Senha alterada" chega. "Sair dos outros aparelhos" mantém este. "Excluir conta" leva à tela 7b.                                                                                                                                                                                                                                                                                                 |
| 49  | Termos e Privacidade | Cadastro (links) ou Configurações → Sobre          | Abrem deslogado e logado; data no topo; seções em cartões; "Fale conosco" só com contato configurado.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 46  | Notificações         | Sino no topo do Hoje ou do Você                    | Todas / Memória / Comunidade; card "Hora de revisar" só com lembranças vencidas; avisos por dia; aceitar/recusar amizade ali mesmo; "Lidas" zera o contador do sino.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 47  | Você (novo)          | Aba Você                                           | Avatar com estrela, nível e XP para o próximo nível, livros lidos / Lembrei 30 dias / sequência, conquistas recentes, meta anual, seu jeito de ler, atalhos.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

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

## 6c. Widgets Android e iOS (Task 09, ADR-023 / ADR-029)

**Novo (ADR-029):** cinco widgets em superfície clara com Plus Jakarta Sans. Confira também:

- **Sequência da semana** carrega (antes mostrava “Can't load widget”) e marca hoje com check
  depois de ler; dias cobertos por proteção aparecem azuis com floco.
- **Calendário**: mês atual, faixas laranja, hoje em destaque, dias protegidos em azul e
  “N proteção(ões)” sob a sequência. Uma proteção exige 7 dias seguidos (desde 2026-10-03);
  pule um dia depois disso e confira que a sequência continua.
- **Continuar leitura**: sem bloco branco; capa real ou a capa tipográfica; título, autor,
  página, progresso e “Continuar leitura ›”. O toque abre a sessão do livro.
- **Liga semanal**: sem amigos, mostra seu XP da semana; com amigos que compartilham, mostra
  “#N entre amigos”, movimento desde ontem, dias restantes e pódio. O toque abre a Liga.
- Redimensione: estreitos viram a variante compacta; textos não cortam e o Bubo não deforma.

Os itens abaixo usam o desenho atual de superfície clara (ADR-029).

Abra **Você → Widgets**. Sem módulo nativo, confira as prévias; os widgets do sistema
precisam de uma nova build instalada (CONFIGURAR 3.14).

Para o APK Android gratuito: `npm run build:android`, depois copie `build/android/bubo-test.apk`
para o celular ou rode `npm run install:android` com USB autorizado. Feche o terminal/Metro e
confira que o app continua abrindo e os widgets aparecem no seletor do launcher.

1. **Android:** adicione os cinco modelos (Sequência, Sequência da semana, Calendário de
   leitura, Continuar leitura e Liga semanal) pelo botão no app ou pelo seletor Widgets → Bubo.
   Compare com as prévias do app: superfície clara, fonte Plus Jakarta Sans, chama + número e
   mascote oficial sem distorção. Redimensione: os médios estreitos viram o pequeno. **iOS:** confira
   pequeno/médio e as três variantes de Sequência na tela bloqueada.
   Widgets do modelo anterior (Ritmo da semana / Bubo completo) devem sumir após a atualização.
2. Sem livro em leitura: estado vazio, sem capa/título/percentual inventados. Com um livro:
   widget mostra a página real; toque abre livro/sessão autenticados. Confirme que a sessão
   não começa a registrar atividade apenas por instalar/tocar no widget.
3. Conclua uma sessão: a chama acende (laranja), o Bubo comemora,
   o dia ganha check na semana e entra na faixa laranja do calendário. Página/progresso
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

**Evidências históricas:** APK Android compilado e verificado em 2026-10-01 (assinatura,
três receptores de widgets e bundle embarcado); build anterior de 2026-10-03 com quatro
receptores verificados. O código atual oferece cinco modelos. **Aceite em aparelho físico ainda
pendente:** não houve celular conectado nesses testes de compilação.
Swift/iOS ainda não foi compilado; o comportamento do launcher/WidgetKit exige este roteiro.

## 6d. Bubo Replay e Stories (ideias 21–23, ADR-034)

**Implementação local:** `npm run verify` passou com 541 testes, formato/lint/tipos/assets/audit
verdes. Prebuild, Kotlin/manifest, bundle Android de release e compilação/instalação de um APK
debug no emulador foram conferidos; a execução visual e a exportação ainda estão em verificação.
O roteiro abaixo ainda precisa de aceite visual/nativo. O Expo Go pode
conferir telas e dados com a API local; exportação, salvamento e compartilhamento precisam de uma
nova build nativa. O envio direto ao editor do Instagram também depende de Instagram instalado e
App ID público real da Meta (CONFIGURAR 3.16). Nenhuma ação publica automaticamente.

| #   | Tela           | Como chegar                          | O que conferir                                                                                                                       |
| --- | -------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 48  | Bubo Replay    | Você → Bubo Replay                   | Mês/ano, capítulos manuais, foco/páginas/dias/livros reais, relatório completo, meses/autorias e compartilhamento do capítulo atual. |
| 49  | Story de livro | Estante → livro → Compartilhar livro | Capa/título/autoria/status reais; Papel/Noite/Violeta, nota opcional de 1 a 5, prévia, Instagram/compartilhar/salvar.                |

### Dados e navegação

1. Em uma conta sem sessões, abra Replay: o período fica vazio, com uma ação útil para voltar à
   leitura. Não aparecem números ou livros de exemplo, comparação com outros leitores ou nota de IA.
2. Adicione um livro como **Já li**, sem sessão, e confira: ele pode gerar um Story como declaração
   pessoal, mas não aumenta foco, páginas, livros com leitura ou conclusões comprovadas no Replay.
3. Faça uma sessão aceita em um livro. Confira páginas avançadas, minutos de foco, data e livro
   no período correto. Retries da mesma sessão não somam duas vezes. Rascunho ainda não enviado,
   pausa e revisão de card não entram como leitura.
4. Com total de páginas conhecido, conclua por sessão cruzando a última página: entra como conclusão
   observada. Sem total, ou apenas mudando status/página manualmente, não há conclusão comprovada.
5. Escolha mês fechado, mês atual e ano: período atual diz que está em andamento; histórico parcial
   não é anunciado como um ano inteiro observado. Meses futuros no ano atual não são meses
   concluídos sem leitura. Confira a virada dezembro/janeiro e sessões perto da meia-noite no fuso.
6. Abra o relatório completo: confira todos os livros, autorias disponíveis e os 12 meses no anual.
   Autoria ausente não é inventada. Horário mais frequente exige pelo menos cinco sessões sem
   empate de hora; o livro mais presente exige duas sessões. Gêneros/citações/Pontes não aparecem.
7. Avance e volte os capítulos: o conteúdo fica estável até sua ação, sem cronômetro/autoplay.
   Ligue **Reduzir movimento**: transições não impedem ler, navegar ou compartilhar.
8. Desligue a rede, tente novamente e troque de conta durante carregamento/exportação. Erros
   oferecem recuperação e nenhum relatório/arte da conta anterior deve aparecer na nova conta.
   Sem relatório em memória, uma consulta pausada mostra offline, sem spinner interminável.
   Com relatório de ontem em memória, a arte conserva **até DD/MM** da geração no servidor e a
   tela informa a atualização real; não atribui esses dados a hoje. Ao abrir novamente com rede,
   solicita atualização. Desligue o app e reabra sem rede: não deve recuperar um Replay persistido.
9. Com dois livros empatados em número de sessões, o destaque diz **Um dos livros a que mais
   voltei**. Meses empatados em foco usam **Um dos meses**. O horário mais frequente com empate
   permanece ausente; a ordem estável dos demais destaques não implica um máximo exclusivo.

### Prévia e imagem

1. No livro, abra **Compartilhar livro** com capa real; depois repita com livro manual sem capa.
   A capa ausente tem composição tipográfica, sem imagem inventada. Aguarde uma capa lenta:
   compartilhar não deve capturar uma imagem incompleta enquanto ela carrega.
2. Troque Papel, Noite e Violeta. Título muito longo, autorias longas, capa clara/escura e ausência
   de autoria não podem criar corte confuso ou texto ilegível. Compare tela de 360 px e fonte 1,6×.
3. Escolha nota, altere e remova: sem nota, a arte não mostra avaliação. Ao sair/reabrir, a nota
   não é uma avaliação salva do livro. Nenhuma resenha nova aparece na Comunidade.
4. Com TalkBack/VoiceOver, confira nomes das escolhas, nota atual e ações; alvos de toque de pelo
   menos 48. A leitura alternativa da composição deve incluir as informações da arte.
5. Exporte cada estilo e um capítulo do Replay. O arquivo deve ser PNG **1080 × 1920**, nítido,
   com tipografia/capa carregadas, logo oficial pequeno e sem botões da tela.
6. Confira que recordação, reflexão, resposta de card, identificadores privados ou dados da conta
   anterior não estão na imagem. A prévia deve representar o arquivo que você vai compartilhar.

### Instagram e sistema

1. Em nova build com Instagram e App ID configurado, toque **Instagram Stories**: o editor abre
   com a arte correta. Confira nitidez e conteúdo dentro das margens, sem corte pela interface.
   Cancele e volte ao Bubo: nada foi publicado e a prévia continua utilizável.
2. Repita sem Instagram e sem App ID: mensagem honesta e opções de **Compartilhar** / **Salvar**;
   nada afirma que foi postado. No Expo Go, a mensagem deve explicar a necessidade da build nativa.
3. Use o compartilhamento do sistema; escolha um destino e cancele. Falha/cancelamento preservam
   o compositor. A entrega recebe uma imagem, não apenas texto ou link.
4. Salve e abra a imagem na galeria. Permissão negada no iPhone/Android que a exigir mostra uma
   orientação e preserva a arte; permitir depois deve possibilitar tentar novamente.
5. No Instagram, use a imagem salva como alternativa. Confira marca, capa, estrelas e textos em
   alta qualidade. Publicar para o próprio público continua uma ação manual do leitor.

O aceite em aparelho físico permanece pendente. Testes, geração de projeto/autolinking, exportação
de JavaScript e compilação são evidências diferentes da imagem recebida no editor do Instagram.
Critérios de métricas e limites: [replay.md](replay.md).

## 7. Só em desenvolvimento

| Tela                     | Como chegar                  | Observação                                                |
| ------------------------ | ---------------------------- | --------------------------------------------------------- |
| Vitrine do design system | Você → "DEV · Design system" | Só aparece em modo desenvolvimento; usa dados de exemplo. |
| Página não encontrada    | Link inválido                | Mostra o Bubo e um caminho de volta.                      |

## 8. O que ainda não existe (não é defeito)

- Comunidade: convites para leitores específicos, sugestões de amigos, rascunho de resenha e
  feed público de resenhas. Os avisos de respostas/ciclos e a caixa de notificações já existem.
- Curva de retenção e Bubo Score.
- Login com Google/Apple, obrigatoriedade de verificação de e-mail e exportação de dados.
- Avaliação de fidelidade ao texto do livro e curva calibrada: veja core-validation.md. A pergunta
  opcional do Gemini já faz parte da conferência de sessão.
- Push no aparelho ainda depende de EAS/Firebase/Apple; widgets dependem de uma nova build nativa.
- Live Activity de sessão e widget Android específico de tela bloqueada.
