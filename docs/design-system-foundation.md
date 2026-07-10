# Bubo Design System Foundation

## Objetivo

Esta fundação desacopla a identidade visual das páginas atuais e cria uma camada semântica que poderá receber o visual definitivo do Bubo sem reescrever cada componente.

## Princípios

- Mobile-first.
- Aparência editorial, sóbria e acolhedora.
- Temas claro e escuro equivalentes.
- Acessibilidade como requisito de componente.
- Tokens semânticos em vez de cores fixas.
- Componentes pequenos, previsíveis e reutilizáveis.

## Tokens iniciais

Os tokens vivem em `frontend/src/index.css` e cobrem:

- background;
- surface;
- surface muted;
- border;
- text;
- text muted;
- primary e primary hover;
- accent;
- danger;
- warning;
- success;
- raios;
- sombras.

Os valores podem mudar futuramente sem alterar a API dos componentes.

## Temas

`ThemeProvider` controla `data-theme` no elemento raiz e persiste a preferência em `localStorage` usando a chave `bubo-theme`. Quando não existe preferência salva, o sistema respeita `prefers-color-scheme`.

## Componentes fundamentais adicionados

### Button

Variantes: `primary`, `secondary`, `ghost` e `danger`.

Tamanhos: `sm`, `md` e `lg`.

Suporta loading, ícones, estado disabled e atributos nativos do botão.

### Input

Suporta label, descrição, erro, required e atributos ARIA associados.

### ThemeToggle

Alterna os temas e fornece nome acessível para leitores de tela.

## Próximos passos

1. Migrar gradualmente os componentes existentes para os tokens.
2. Criar Select, Textarea, Card, Modal, EmptyState, Skeleton e Avatar.
3. Aplicar ThemeToggle no layout definitivo.
4. Criar equivalentes no Figma usando os mesmos nomes semânticos.
5. Mapear componentes com Code Connect depois da estabilização da API.
