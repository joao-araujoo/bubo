# Widgets do Bubo

Desde a [ADR-029](adr/ADR-029-widget-redesign-freeze-league.md), os widgets seguem a limpeza
das referências do Duolingo com a identidade do Bubo: uma superfície clara, uma cor de destaque
por widget, Plus Jakarta Sans e o Bubo oficial entrando pelo canto. Abra **Você → Bubo na sua
tela** para ver as prévias com os seus dados reais.

| Widget                  | Tamanho principal | O que mostra                                                                   | Toque abre      |
| ----------------------- | ----------------- | ------------------------------------------------------------------------------ | --------------- |
| **Sequência**           | 2×2               | Chama + número, “dias seguidos”, proteções prontas                             | Hoje            |
| **Sequência da semana** | 4×2               | “12 dias seguidos”, frase do momento, S T Q Q S S D com checks reais           | Hoje            |
| **Calendário**          | 4×2               | Mês atual, dias seguidos em faixas laranja, dias protegidos em azul, sequência | Hoje            |
| **Continuar leitura**   | 4×2 (2×2)         | Capa real (ou a capa tipográfica do app), título, autor, página, progresso     | Sessão do livro |
| **Liga semanal**        | 4×2 (2×2)         | “#3 entre amigos”, movimento desde ontem, dias restantes, pódio com XP real    | `/liga`         |

Quando estreitos, os modelos 4×2 viram a variante compacta. Todos se adaptam à proporção do
launcher (um 4×2 do Pixel é mais alto que o de outros aparelhos).

## Proteção de sequência

A cada **7 dias seguidos** com leitura ou revisão você ganha **1 proteção** (até **2**). Se um
dia terminar sem atividade, uma proteção cobre esse dia automaticamente: a sequência continua,
mas o dia protegido não soma. Sem proteção, a sequência zera. A regra vale a partir de
2026-10-03 (nunca retroativa) e é recalculada a partir das atividades reais
(`computeStreakState`, `/v1/me/stats.streakFreeze`). Nada é guardado à parte.

No calendário: **laranja** = dia válido, **azul com floco** = dia protegido, **normal** = sem
atividade. Na semana, o dia protegido é um círculo azul com floco; o chip “❄ N” mostra
proteções prontas. Com proteção pronta, a noite fica calma (sem alerta vermelho).

## Liga semanal

Você e os amigos aceitos que **compartilham as leituras** (Amigos → Privacidade), pelo XP real
de sessões e revisões da semana (segunda a domingo). De cada amigo conta só a atividade depois
que ele passou a compartilhar. “+1 posição hoje” compara com a posição só com o XP até ontem.
Sem amigos, o widget mostra seu XP da semana e convida a adicionar amigos nos clubes. Avatares
são as iniciais (o mesmo avatar do app). A liga nunca é salva no aparelho.

## O Bubo ao longo do dia

O app calcula os humores do dia (`@bubo/domain`, `buildWidgetMoods`) e o widget troca sozinho:

| Quando                             | Pose do Bubo                             | Frase                                                       |
| ---------------------------------- | ---------------------------------------- | ----------------------------------------------------------- |
| Já leu hoje                        | comemorando                              | Leitura feita hoje! (30+ dias: “Que sequência linda!”)      |
| Só revisou hoje                    | animando                                 | Revisão feita hoje!                                         |
| Meta semanal de leitura batida     | conquista                                | Meta da semana batida!                                      |
| Proteção usada ontem               | feliz                                    | A proteção salvou sua sequência                             |
| 6h, com revisões disponíveis       | revisando                                | N revisões te esperam                                       |
| 6h, com livro em leitura           | lendo                                    | Bora ler um pouquinho?                                      |
| 6h, sequência alta (30+) sem livro | confiante                                | Bora manter o ritmo?                                        |
| 6h, sem sequência                  | curioso                                  | Que tal começar hoje?                                       |
| 18h, em risco, com proteção pronta | pensando                                 | Leia hoje: a proteção fica guardada                         |
| 18h / 21h / 22h, em risco          | preocupado / surpreso / preocupado + “!” | Salve sua sequência! / Está ficando tarde! / Última chance! |
| Noite (22h–6h)                     | dormindo                                 | Missão cumprida. Bons sonhos! / Zzz…                        |
| Dados antigos                      | com dúvida                               | Abra o Bubo (sem números)                                   |
| Sem conta                          | boas-vindas                              | Olá! Entre para ver sua sequência                           |

No “Continuar leitura”, o Bubo lê enquanto o livro está em andamento, comemora quando você já
leu hoje e aparece com a pilha de livros quando não há leitura ativa.

## Tipografia (limitação do Android)

O Android ignora `android:fontFamily="@font/…"` em widgets (RemoteViews). Por isso o Android
desenha cada widget num Canvas (`BuboPainter.kt`) com os arquivos oficiais da Plus Jakarta Sans
(Regular, Medium, SemiBold, Bold, ExtraBold) copiados para os assets do módulo. Consequências:
o texto acompanha a fonte do sistema só até +15 % (para caber nas células) e o leitor de tela
lê uma descrição única do widget. No iPhone a fonte é carregada pela extensão (`UIAppFonts`).

## Adicionar no celular

**Precisa de uma nova build nativa.** Expo Go e atualização só de JavaScript não incluem os
widgets.

- **Android:** toque e segure a tela inicial → Widgets → Bubo, ou use “Adicionar à tela
  inicial” no app. As prévias do seletor mostram só a composição (sem números).
- **iPhone:** Editar → Adicionar Widget → Bubo. Tela bloqueada: Personalizar → Adicionar
  Widgets → Bubo → Sequência.

## Privacidade e dados

Somente dados publicados e da própria conta entram no widget (sequência, dias, livro atual,
posição na liga). Reflexões, respostas de memória e tokens nunca. “Ocultar título na tela
bloqueada” vem ligado. Os dados expiram na virada do dia ou 24 h depois; sem dados recentes o
widget pede para abrir o Bubo. Desligar “Atualizar meus widgets” ou sair da conta limpa tudo.

## Desenvolvimento e aceite

- Cores: `src/theme/colors.ts` (`widgetPalette`, `coverPalettes`). O plugin
  `plugins/with-bubo-widgets.config.cjs` gera `BuboTokens.kt`/`BuboTokens.swift` (cores e
  ícones), copia poses e fontes e escreve os `appwidget-provider`.
- Android: `modules/bubo-widgets/android/src/main/java/expo/modules/bubowidgets/`
  (`BuboWidgetModel.kt`, `BuboPainter.kt`, `BuboWidgetProvider.kt`). Layouts estáticos só usam
  `FrameLayout`, `LinearLayout` e `ImageView` (um teste impede `<View>` de novo).
- iOS: `native-widgets/BuboWidgets.swift`. Prévias no app: `src/features/widgets/WidgetPreview.tsx`.
- **Validado em 2026-10-03** num emulador Android 15 (x86_64): os cinco widgets, todos os
  estados (sequência alta com proteção, risco às 19h e 22h, noite, usuário novo, sem livro, liga
  com/sem amigos, líder, dados antigos, sem conta), deep links e um fluxo ponta a ponta real
  (sessão → API local → app → widget). Pendentes: aceite em aparelho físico e compilação Swift.

Roteiro de aceite: [TESTAR-TELAS.md](TESTAR-TELAS.md) seção 6c. APK: `npm run build:android`.
