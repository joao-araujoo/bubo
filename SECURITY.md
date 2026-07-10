# Política de segurança

## Versões suportadas

Enquanto o Bubo estiver em desenvolvimento ativo, somente a versão mais recente da branch `main` recebe correções de segurança.

## Como relatar uma vulnerabilidade

Não abra uma issue pública contendo credenciais, tokens, dados pessoais, bypass de autorização ou instruções reproduzíveis para exploração.

Envie um relato privado ao proprietário do repositório pelo canal de contato associado ao perfil do GitHub. Inclua:

- área afetada;
- impacto provável;
- passos mínimos para reprodução;
- ambiente e versão testados;
- logs ou capturas sem dados pessoais;
- sugestão de correção, quando houver.

Evite acessar, alterar ou remover dados que não pertençam a você. Não execute testes de carga ou automação agressiva sem autorização.

## Escopo prioritário

Relatos especialmente importantes incluem:

- acesso a dados de outro usuário;
- bypass de autenticação ou autorização;
- exposição de `JWT_SECRET`, tokens ou chaves de IA;
- injeção em MongoDB;
- execução remota de código;
- XSS persistente;
- SSRF;
- upload ou payload sem limite;
- CORS permissivo em produção;
- vazamento de Deep Reviews privadas;
- manipulação de progresso, clubes ou notificações de terceiros.

## Resposta esperada

O projeto procurará:

1. confirmar o recebimento;
2. reproduzir o problema em ambiente isolado;
3. classificar impacto e urgência;
4. preparar correção e testes de regressão;
5. publicar a correção antes de detalhes exploráveis.

Não existe SLA formal enquanto o projeto não opera como serviço público.

## Boas práticas para operadores

- substitua o JWT secret padrão;
- use HTTPS;
- mantenha MongoDB em rede privada;
- restrinja `CLIENT_URL`;
- não execute o seed demonstrativo em produção;
- faça backups e teste restaurações;
- atualize imagens e dependências regularmente;
- monitore respostas 5xx, reinícios e espaço em disco;
- mantenha chaves de IA apenas no backend.
