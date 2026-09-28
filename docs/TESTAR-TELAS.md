# Roteiro de testes — todas as telas do Bubo

Lista de **todas as telas que existem hoje**, como chegar em cada uma e o que conferir. Use quando
terminar as configurações de [../CONFIGURAR.md](../CONFIGURAR.md). Status de cada tela frente ao
Stitch: [screens.md](screens.md).

Última atualização: 2026-09-27 (Task 07 — Comunidade). Total: 34 telas, mais 2 de desenvolvimento.

---

## Como rodar o app para testar

**Opção A — local, com Expo Go (funciona hoje, sem configurar nada):**

1. No computador: `npm install`, depois `npm run dev:api` e, em outro terminal, `npm run dev:mobile`.
2. Em `apps/mobile/.env`: `EXPO_PUBLIC_API_URL=http://<IP-do-computador-na-rede>:8787`.
   Em `apps/api/.dev.vars`: `BETTER_AUTH_URL=http://<mesmo-IP>:8787`.
3. Celular na mesma rede Wi-Fi → abra o Expo Go → leia o QR code.

Atenção: se o `apps/api/.dev.vars` tiver `DATABASE_URL`, o `dev:api` usa o **mesmo banco da
produção** (ver CONFIGURAR.md 3.2). Sem essa linha, tudo roda local (PGlite).

**Opção B — contra a produção:** exige um build EAS (CONFIGURAR.md 3.3). O Expo Go **não** consegue
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

| #   | Tela                 | O que conferir                                                  |
| --- | -------------------- | --------------------------------------------------------------- |
| 8   | Hábito (2/6)         | Barra de progresso "2 de 6"; só avança com uma opção escolhida. |
| 9   | Objetivo (3/6)       | Seleção múltipla; voltar mantém as escolhas.                    |
| 10  | Interesses (4/6)     | Chips de gêneros; seleção múltipla.                             |
| 11  | Primeiro livro (5/6) | Busca no catálogo, leitor de ISBN, entrada manual e "Pular".    |
| 12  | Concluído (6/6)      | Não promete XP; "Ir para o Bubo" abre a aba Hoje.               |

## 3. Abas principais

| #   | Tela           | O que conferir                                                                                                                   |
| --- | -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 13  | **Hoje**       | Sequência e XP reais no topo; "Lendo agora"; "Recuperação ativa" com cards pendentes; semana cognitiva; missão do dia.           |
| 14  | **Estante**    | Livros agrupados por status; vazio mostra o Bubo; botão para adicionar.                                                          |
| 15  | **Revisar**    | Contagem de cards para hoje e selo na aba; sem cards → explica como criar.                                                       |
| 16  | **Comunidade** | Ver seção 6.                                                                                                                     |
| 17  | **Você**       | Nome, e-mail, lidos/XP/sequência reais; Aparência; Minha memória; Mural de conquistas; Leitores bloqueados; Sair; Excluir conta. |

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

| #   | Tela                 | Como chegar                | O que conferir                                                                                             |
| --- | -------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 25  | Revisão "sem espiar" | Revisar → Ainda lembro?    | Tentar → mostrar → Lembrei/Quase/Esqueci; falha ao salvar mantém o card; resumo no fim.                    |
| 26  | Minha memória        | Você → Minha memória       | 7 dias de Lembrei/Quase/Esqueci em gráfico; aviso "não é medida de retenção"; vazio explica como começar.  |
| 27  | Mural de conquistas  | Você → Mural de conquistas | Nível pelo XP real; 13 conquistas; bloqueadas mostram progresso (ex.: 3/10); nenhuma é dada sem atividade. |

## 6. Comunidade (nova na Task 07) — use duas contas: **A** e **B**

| #   | Tela                | Como chegar                                    | O que conferir                                                                                                                                                                                                                        |
| --- | ------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 28  | Comunidade (aba)    | Aba Comunidade                                 | Sem clubes: card do Bubo "Clubes sem spoiler". Busca por nome do clube ou do livro. "Meus clubes" separado de "Descobrir clubes".                                                                                                     |
| 29  | Criar novo clube    | Comunidade → Criar um clube                    | Nome (3–60), proposta, ícone, livro **do catálogo** da sua Estante (livro manual não aparece), meta semanal. Limite de 5 clubes.                                                                                                      |
| 30  | Clube               | Tocar num clube                                | **B (não membro):** vê o livro e "Entrar e aceitar as diretrizes"; ao entrar, o livro vai para a Estante dele. **Membro:** faixa "Blindagem anti-spoiler ativa" com a página. Menu ⋮: diretrizes, sair (membro) ou excluir (criador). |
| 31  | Novo debate         | Clube → Novo debate                            | Título, página (com −10/−1/+1/+10), texto. Página maior que o livro é recusada. Página 0 = debate geral.                                                                                                                              |
| 32  | Debate              | Tocar num debate                               | Respostas nunca têm página menor que o debate. Ações: Apagar (seu), Denunciar, Bloquear autor, e para o criador Remover/Restaurar.                                                                                                    |
| 33  | Diretrizes do clube | Clube → ⋮ → Diretrizes, ou "Ler as diretrizes" | 4 regras, exemplo certo/errado, sua página atual, como funciona a moderação.                                                                                                                                                          |
| 34  | Leitores bloqueados | Você → Leitores bloqueados                     | Lista quem você bloqueou; "Desbloquear" faz o conteúdo voltar.                                                                                                                                                                        |

### Roteiro anti-spoiler (o teste mais importante da Comunidade)

1. **A** adiciona um livro do catálogo com número de páginas, cria um clube com ele e abre um
   debate na **página 100**.
2. **B** entra no clube (página 0). O debate aparece como **"Contém spoiler da página 100 — faltam
   100 páginas"**, sem título nem texto.
3. **B** toca em "Quero espiar mesmo assim" → o texto aparece só nessa tela.
4. **B** vai na Estante → livro → atualiza para a página 100 → volta ao clube: o debate agora
   aparece normal.
5. **B** responde com página 0 → a resposta fica marcada "Pág. 100" (herda a página do debate).

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

## 7. Só em desenvolvimento

| Tela                     | Como chegar                  | Observação                                                |
| ------------------------ | ---------------------------- | --------------------------------------------------------- |
| Vitrine do design system | Você → "DEV · Design system" | Só aparece em modo desenvolvimento; usa dados de exemplo. |
| Página não encontrada    | Link inválido                | Mostra o Bubo e um caminho de volta.                      |

## 8. O que ainda não existe (não é defeito)

- Comunidade: clubes privados e convites, membros e estatísticas do clube, enquetes, resenhas,
  feed de amigos, notificações (Task 08).
- Curva de retenção, Bubo Score, ciclos de leitura do clube.
- Configurações, notificações push, login com Google/Apple, verificação de e-mail, exportação de
  dados, recursos de IA.
