# Checklist de release do Bubo

Use esta lista antes de marcar uma versão como pronta para demonstração, homologação ou produção.

## Código e integração

- [ ] `main` está atualizada e sem branches críticas pendentes.
- [ ] Frontend Quality Gate passou.
- [ ] Backend Quality Gate passou.
- [ ] Clone-ready smoke test passou.
- [ ] Não há placeholders em fluxos principais.
- [ ] Não há comentários temporários de diagnóstico no PR.
- [ ] Dependências novas possuem justificativa e lockfile coerente.

## Experiência

- [ ] Cadastro, login e logout foram testados.
- [ ] Onboarding pode ser concluído e configurado depois.
- [ ] Home, Biblioteca, Descobrir, Feed, Clubes, Coach, Conquistas e Perfil abrem.
- [ ] Deep Review aprovada atualiza progresso, Coach, feed e conquistas.
- [ ] Estados vazios, loading e erro estão compreensíveis.
- [ ] Navegação funciona em 320px, tablet e desktop.
- [ ] Fluxos essenciais funcionam por teclado.
- [ ] Tema claro e escuro foram verificados.
- [ ] PWA instala e sinaliza modo offline.

## IA

- [ ] `AI_PROVIDER` está correto para o ambiente.
- [ ] Chave externa, quando usada, existe somente no backend.
- [ ] Modo local funciona sem chave.
- [ ] Fallback conectado → local está identificado na interface.
- [ ] Respostas malformadas não aprovam reviews.
- [ ] Limites de custo e cota do provedor foram revisados.

## Segurança

- [ ] `JWT_SECRET` é aleatório e possui pelo menos 24 caracteres.
- [ ] `.env` não está versionado.
- [ ] `CLIENT_URL` contém somente origens autorizadas.
- [ ] MongoDB não está exposto publicamente.
- [ ] HTTPS está ativo.
- [ ] Rate limits são adequados ao tráfego esperado.
- [ ] Logs não exibem senha, token, chave de IA ou texto integral das reviews.
- [ ] Respostas 500 não retornam stack em produção.
- [ ] Seed demonstrativo não foi executado em produção real.

## Dados

- [ ] Backup recente existe.
- [ ] Restauração foi testada em ambiente separado.
- [ ] Mudanças de schema são compatíveis ou possuem migração.
- [ ] Plano de rollback está registrado.

## Operação

- [ ] `/api/health` responde `ok` e `database=connected`.
- [ ] Frontend e backend estão healthy no Docker.
- [ ] Logs estruturados chegam ao destino esperado.
- [ ] Alertas de disponibilidade e erro estão configurados.
- [ ] Disco, memória e volume MongoDB possuem monitoramento.
- [ ] Domínio e certificado HTTPS estão válidos.

## Comunicação

- [ ] README corresponde aos comandos atuais.
- [ ] `.env.example` possui todas as variáveis necessárias.
- [ ] Notas da versão descrevem mudanças e riscos.
- [ ] Credenciais de demonstração, quando aplicáveis, estão corretas.
- [ ] Limitações conhecidas estão registradas.
