# Checklist de release do Bubo

Use esta lista antes de marcar uma versão como pronta para demonstração, homologação ou produção.

## Código e integração

- [ ] `main` está atualizada e sem branches críticas pendentes.
- [ ] Frontend Quality Gate passou.
- [ ] Backend Quality Gate passou.
- [ ] Clone-ready smoke test passou.
- [ ] Observability Journey passou.
- [ ] Redis Journey passou quando Redis estiver habilitado.
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
- [ ] Ausência de chave deixa o Coach explicitamente indisponível, sem nota simulada.
- [ ] Respostas malformadas não aprovam reviews.
- [ ] Limites de custo e cota do provedor foram revisados.

## Segurança

- [ ] `JWT_SECRET` é aleatório e possui pelo menos 24 caracteres.
- [ ] `.env` não está versionado.
- [ ] `CLIENT_URL` contém somente origens autorizadas.
- [ ] MongoDB não está exposto publicamente.
- [ ] Redis não está exposto publicamente.
- [ ] URLs Redis com credenciais não aparecem em logs, métricas ou health checks.
- [ ] HTTPS está ativo.
- [ ] Rate limits são adequados ao tráfego esperado.
- [ ] Múltiplas réplicas usam Redis obrigatório e compartilhado.
- [ ] Logs não exibem senha, token, chave de IA ou texto integral das reviews.
- [ ] Respostas 500 não retornam stack em produção.
- [ ] Seed demonstrativo não foi executado em produção real.

## Dados

- [ ] Backup MongoDB recente existe.
- [ ] Restauração MongoDB foi testada em ambiente separado.
- [ ] Mudanças de schema são compatíveis ou possuem migração.
- [ ] Plano de rollback está registrado.
- [ ] Redis é tratado como infraestrutura reconstruível, não como fonte principal dos dados.

## Operação

- [ ] `/api/health/live` responde `ok`.
- [ ] `/api/health/ready` responde `ready=true`.
- [ ] MongoDB aparece como `connected`.
- [ ] Redis aparece como `connected` quando habilitado.
- [ ] Interrupção de Redis obrigatório torna readiness indisponível.
- [ ] Backend recupera readiness depois que Redis retorna.
- [ ] Frontend, backend, MongoDB e Redis estão healthy no Docker.
- [ ] Métricas exigem token em produção.
- [ ] Logs estruturados chegam ao destino esperado.
- [ ] Alertas de disponibilidade, erro, latência e reconexão estão configurados.
- [ ] Disco, memória, volume MongoDB e memória Redis possuem monitoramento.
- [ ] Domínio e certificado HTTPS estão válidos.

## Comunicação

- [ ] README corresponde aos comandos atuais.
- [ ] `.env.example` possui todas as variáveis necessárias.
- [ ] `docs/DEPLOYMENT.md`, `docs/OBSERVABILITY.md` e `docs/REDIS.md` estão atualizados.
- [ ] Notas da versão descrevem mudanças e riscos.
- [ ] Credenciais de demonstração, quando aplicáveis, estão corretas.
- [ ] Limitações conhecidas estão registradas.
