# Bubo 3.1 — Product Readiness

## Objetivo

Preparar o Bubo para uso real com múltiplos usuários, corrigindo as jornadas críticas de catálogo, acervo e Deep Review e adicionando fundações de performance e observabilidade.

## Jornadas auditadas

1. Entrar no aplicativo.
2. Buscar um livro.
3. Adicionar o livro ao acervo.
4. Definir ou alterar o estado da leitura.
5. Atualizar o progresso.
6. Iniciar uma Deep Review escolhendo explicitamente o livro.
7. Retornar ao acervo sem perder estado ou repetir consultas desnecessárias.

## Problemas encontrados

- a página de descoberta executava uma busca automática ao montar;
- resultados eram ordenados por confiança técnica, não por relevância;
- informações internas de validação apareciam nos cards;
- o Google Books não tinha recuperação quando uma chave configurada era inválida;
- não existia cache compartilhado entre instâncias da API;
- o botão global de Deep Review escolhia um livro silenciosamente;
- livros em “Quero ler” não possuíam ação direta para iniciar leitura;
- o acervo não possuía edição de progresso, remoção ou painel de detalhes;
- páginas eram importadas de forma síncrona no bundle inicial;
- o modal base não possuía portal, restauração de foco ou isolamento de interação.

## Critérios de aceite

- nenhuma busca ocorre sem ação do usuário;
- consultas repetidas usam cache e não atingem os provedores novamente;
- resultados preservam estado ao navegar entre páginas;
- o usuário consegue adicionar um livro em até dois passos;
- o usuário consegue iniciar leitura, atualizar página e abrir Deep Review pelo card;
- o botão global sempre apresenta seleção quando houver mais de um livro elegível;
- a biblioteca pode remover um item com confirmação;
- rotas do frontend são carregadas sob demanda;
- todos os fluxos críticos possuem testes de regressão;
- o CI valida a jornada protegida do acervo no smoke test.
