# Widgets do Bubo

Os widgets seguem o estilo dos widgets de sequência do Duolingo
([ADR-026](adr/ADR-026-streak-widget-scenes.md)): uma cena colorida de ponta a ponta, a chama
com o número da sequência, uma frase curta e o Bubo espiando da borda de baixo. Abra
**Você → Bubo na sua tela** para ver os quatro modelos com os seus dados reais:

- **Sequência** (pequeno): chama + dias seguidos e a frase do momento. No iPhone também fica
  na tela bloqueada (circular, retangular e em linha).
- **Sequência da semana** (médio): “N dias de sequência” e um check em cada dia da semana com
  leitura ou revisão. Hoje aparece com um anel até você ler.
- **Calendário de leitura** (médio): os dias ativos do mês ficam ligados em faixas, e hoje
  ganha um círculo. Fundo menta quando você já leu hoje e azul-lavanda enquanto não leu.
- **Continuar leitura** (médio): cartão branco com capa, título, página, progresso e um toque
  para voltar à sessão. No tamanho pequeno, mostra a página.

## O Bubo ao longo do dia

O app calcula os humores do dia (`@bubo/domain`, `buildWidgetMoods`) e o widget troca sozinho
nos horários abaixo, sem abrir o app:

| Quando                          | Cena            | Pose do Bubo | Frase                                |
| ------------------------------- | --------------- | ------------ | ------------------------------------ |
| Já leu hoje                     | dourada         | comemorando  | Leitura feita hoje!                  |
| Só revisou hoje                 | dourada         | animando     | Revisão feita hoje!                  |
| Meta semanal de leitura batida  | menta           | conquista    | Meta da semana!                      |
| 6h, com revisões disponíveis    | verde-água      | revisando    | N revisões te esperam                |
| 6h, com livro em leitura        | azul            | lendo        | Bora ler um pouquinho?               |
| 6h, sem livro e com sequência   | azul            | feliz        | Bora manter o ritmo?                 |
| 6h, sem sequência               | rosa            | boas-vindas  | Que tal começar hoje?                |
| 18h, sequência em risco         | pôr do sol + !  | preocupado   | Salve sua sequência!                 |
| 21h, sequência em risco         | vermelha + !    | surpreso     | Está ficando tarde!                  |
| 22h, sequência em risco         | vermelha + !    | preocupado   | Última chance!                       |
| Noite (22h–6h) sem risco        | noite estrelada | dormindo     | Missão cumprida. Bons sonhos! / Zzz… |
| Dados antigos (dia virou, 24 h) | grafite         | com dúvida   | Abra o Bubo                          |
| Sem conta ou nunca sincronizado | lavanda         | boas-vindas  | Olá!                                 |

A chama acende (laranja) só quando já houve leitura ou revisão hoje; antes disso ela aparece
vazada. A sequência é a mesma do app: dias seguidos com sessão de leitura **ou** revisão.
A meta semanal conta só dias de leitura. Os alertas da noite só aparecem quando existe uma
sequência real a perder.

Todas as poses são oficiais e copiadas byte a byte. O efeito de “espiar” é apenas o recorte
da borda do widget; a imagem não é cortada, redesenhada nem recolorida.

## Adicionar no celular

**Precisa de uma nova build nativa com os widgets incluídos.** Expo Go e uma atualização só de
JavaScript não acrescentam o módulo/extension ao app ([Expo: módulos locais](https://docs.expo.dev/modules/get-started/)). A tela de prévias continua acessível em
versões sem o módulo e explica essa diferença. Widgets do modelo anterior (Ritmo da semana /
Bubo completo) somem depois da atualização e precisam ser adicionados de novo.

- **Android:** toque e segure uma área vazia da tela inicial → Widgets → Bubo → arraste um
  modelo. Você também pode usar “Adicionar à tela inicial” no app quando o launcher permitir.
  Os modelos médios, quando estreitos, viram o modelo pequeno. Não há widget Android
  específico para a tela bloqueada.
- **iPhone:** toque e segure a tela inicial → Editar → Adicionar Widget → Bubo. Na tela
  bloqueada: toque e segure → Personalizar → Adicionar Widgets → Bubo → Sequência.

## Privacidade e dados

“Ocultar título na tela bloqueada” vem ligado: no iPhone, o widget retangular mostra a página
em vez do título. Capa nunca aparece na tela bloqueada. Nenhuma reflexão, resposta de memória,
texto de clube, senha ou token é compartilhado com os widgets. Para limpar os dados deste
aparelho, desligue “Atualizar meus widgets” ou saia da conta.

As atualizações vêm das consultas da sua conta ao usar o app (`/v1/me/stats` traz a sequência e
os dias ativos do mês). Quando a informação deixa de ser recente (virada do dia ou 24 horas desde
a resposta mais antiga), o widget pede para abrir o Bubo e não mostra números. No Android, a
troca de humor pode atrasar até ~30 min (limite de atualização do sistema); no iPhone, o widget
agenda as trocas nos horários da tabela.

## Desenvolvimento e aceite

As cores das cenas ficam em `src/theme/colors.ts` (`widgetScenes`, `widgetFlame`). O plugin
local (`plugins/with-bubo-widgets.config.cjs`) gera a partir delas as cores, gradientes, faixas do
calendário e decorações vetoriais (brilhos, lua e estrelas, confete, brasas, corações) do Android
e o `BuboTokens.swift` do iOS. Layouts Android: `modules/bubo-widgets/android/src/main/res/layout`;
SwiftUI: `native-widgets/BuboWidgets.swift`; prévias no app:
`src/features/widgets/WidgetPreview.tsx`.

Para gerar o APK Android gratuito, rode `npm run build:android` na raiz; instalação e
ferramentas em [build-mobile.md](build-mobile.md). iOS requer macOS/Xcode:
`npm run ios --workspace @bubo/mobile`, com App Group/assinatura configurados na conta Apple.
EAS deve descobrir a extensão `BuboWidgetsExtension` / `com.joaoaraujo.bubo.widgets` e os
entitlements do App Group; veja [CONFIGURAR.md](../CONFIGURAR.md).

O roteiro em [TESTAR-TELAS.md](TESTAR-TELAS.md) (seção 6c) continua pendente em aparelhos;
Swift/iOS ainda não foi compilado.
