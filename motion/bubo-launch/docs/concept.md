# Bubo — "Feche o livro." (filme de lançamento, 9:16)

## A verdade do produto

Todo app de leitura celebra a leitura. O Bubo começa onde ela termina: quando você **fecha o
livro**. A tela de recordação do próprio app diz isso com todas as letras — _"Feche o livro. Abra a
memória."_ (`apps/mobile/src/app/sessao/[id].tsx`). Depois vem a revisão espaçada ("Hora de
lembrar", Lembrei / Quase / Esqueci) e o resumo diz _"Isso ficou com você."_ (`revisao.tsx`).

O filme não explica isso. Ele mostra uma única lembrança vivendo a vida inteira em 16,5 segundos.

## Ideia

**A vida de uma lembrança.** Uma linha de _Dom Casmurro_ — "Olhos de ressaca?" — é lida,
grifada, o livro se fecha sobre ela, e no escuro **dois olhos se abrem**. O Bubo é a memória
acordada dentro do livro fechado. A linha vira palavras suas no app, o tempo passa folha a folha
(dia 1, 2, 8, 23, 61) e ela volta toda vez, mais firme. No fim, o mesmo livro está na asa do Bubo:
o que você leu vai com você.

### Por que _Dom Casmurro_ e "olhos de ressaca"

- Domínio público (Machado de Assis, 1899): texto real, sem inventar um livro.
- É a linha mais lembrada da literatura brasileira — o leitor reconhece em meio segundo.
- É sobre **olhos que puxam para dentro**. A identidade do Bubo são os olhos (o símbolo é um par
  de olhos com estrelas). A rima entre a frase e o personagem é o coração do filme: a câmera é
  puxada para dentro dos olhos do Bubo como a vaga que se retira da praia.

### O paradoxo como gancho

Um app de leitura que, no primeiro segundo, manda: **"Feche o livro."** O leitor pensa "como
assim?". Um segundo depois, no escuro, olhos se abrem: **"Abra a memória."** A pergunta "que app
é esse?" está feita antes dos 2 s, e a resposta é o próprio produto.

## O que o filme mostra (quatro coisas, bem)

1. **Ler com atenção** — página macro, grifo roxo físico.
2. **Lembrar sem espiar, com suas palavras** — a tela real de recordação; as palavras impressas
   (serifa) viram palavras suas (Plus Jakarta Sans) ao entrar no campo.
3. **Voltar na hora certa** — o card real ("O que ficou com você de “Dom Casmurro” (págs. 61–68)?")
   volta nos dias 1, 2, 8, 23 e 61: é o agendamento SM-2 real do Bubo
   (`packages/scoring/src/retention.ts`) para quem responde "Lembrei" toda vez. A tinta da nota
   desbota entre as revisões e desbota menos a cada volta.
4. **Fica** — "Isso ficou com você." com o Bubo comemorando; o livro termina na asa dele (pose
   oficial `main`, que segura um livro fechado da mesma cor do livro do filme, #2C0B4F).

Fora do corte, de propósito: clubes, widgets, estatísticas, liga. Não cabem em 16,5 s sem virar
lista.

## Continuidade: uma coreografia só

Cada elemento causa o próximo:

- o **grifo** roxo é o primeiro traço de cor do filme → as palavras grifadas se soltam do papel;
- a **capa fechando** é o corte para o escuro (escuridão física, não um fade);
- a **fresta de luz** que some quando o livro fecha volta como **pálpebra**: os olhos abrem;
- os olhos se abrem em **íris de luz** e revelam o mundo lilás do app;
- o **título gigante** "Feche o livro. Abra a memória." encolhe e pousa como o título real da tela;
- as **palavras soltas** da página voam para o campo e mudam de fonte (do livro para você);
- o toque em "Salvar sessão" vira a **página** que passa → o bloco de dias;
- as **páginas do tempo** passam por baixo dos pés do Bubo (ele pula corda com elas);
- a última página fecha o livro, que cai na asa do Bubo → assinatura.

## O Bubo como personagem

Só poses oficiais, nunca redesenhadas (regra 3 do `AGENTS.md`). A atuação vem de animação por
substituição (troca de pose no tempo certo, como bonecos de stop-motion), squash & stretch
controlado no corpo inteiro, arcos, antecipação e contato. Ele observa no escuro (olhos
mascarados da pose `neutral`), fica curioso, anota, tem a ideia, pula as páginas do tempo,
comemora e vai embora com o livro. Fofo, não infantil: tempo de reação, não caretas.

## Tom

Quente, tátil, esperto. Papel e tinta no começo, roxo e lilás em todo o resto. Humor de timing
(o pulo de corda), não de piada. Recompensa física (botões que afundam no aro, como no app).

## Som

O mundo do livro é silencioso: papel, caneta, respiração do quarto. O livro bate e há silêncio.
A primeira nota musical nasce com os olhos. O groove (120 BPM, felt piano, marimba, madeiras,
baixo quente) entra quando a luz invade e acompanha a lembrança até o acorde final no logo.
Tudo sintetizado em código a partir da mesma linha do tempo que move a imagem.

## Honestidade

- Nenhuma métrica inventada. Intervalos, XP e textos são os do código do Bubo.
- Nenhuma funcionalidade inventada. As telas mostradas existem (recordação, revisão, resumo).
- Os números da história (dias 1, 2, 8, 23, 61; "+30 XP" por 1 card lembrado em uma revisão
  concluída: 2 + 3 + 25) saem das regras reais. São uma história ilustrativa, não dados de
  usuários.
- Texto de _Dom Casmurro_ em domínio público.
