/**
 * Terms of Use and Privacy Policy (ADR-039), in plain Brazilian Portuguese. They describe what the
 * code actually does: which data exists, which providers touch it and which choices the reader
 * has. Update the date whenever the practices change. No company data is invented here: the
 * operator is the one identified in the app stores and in the contact shown under Sobre.
 */
export type LegalSection = { heading: string; paragraphs: string[]; bullets?: string[] };
export type LegalDoc = {
  title: string;
  updatedAt: string;
  intro: string;
  sections: LegalSection[];
};

export const LEGAL_UPDATED_AT = '29/10/2026';

export const TERMS_OF_USE: LegalDoc = {
  title: 'Termos de Uso',
  updatedAt: LEGAL_UPDATED_AT,
  intro:
    'O Bubo é um aplicativo para ler com foco, lembrar o que você leu e revisar na hora certa, sozinho ou em clubes sem spoilers. Ao criar uma conta você concorda com estes termos. Eles foram escritos para serem lidos, sem letras miúdas.',
  sections: [
    {
      heading: '1. Quem oferece o Bubo',
      paragraphs: [
        'O Bubo é oferecido pelo responsável identificado na página do aplicativo nas lojas (App Store e Google Play) e no contato indicado em Configurações → Sobre. Nestes termos, "nós" somos esse responsável e "você" é a pessoa leitora com uma conta.',
      ],
    },
    {
      heading: '2. Sua conta',
      paragraphs: [
        'Para usar o Bubo você precisa de uma conta com nome, e-mail e senha. Você se compromete a informar dados verdadeiros e a manter a senha só com você.',
        'Em aparelhos novos, além da senha, pedimos um código enviado ao seu e-mail. Você pode lembrar um aparelho por 30 dias e pode ligar ou desligar o código em Configurações → Conta e segurança.',
      ],
      bullets: [
        'O Bubo não é destinado a menores de 13 anos.',
        'Avise-nos se suspeitar de uso indevido da sua conta.',
        'Você pode excluir a conta a qualquer momento no próprio app; a exclusão apaga seus dados e não pode ser desfeita.',
      ],
    },
    {
      heading: '3. Seu conteúdo é seu',
      paragraphs: [
        'Suas reflexões, exercícios de recordação, cartões de revisão, avaliações privadas, resenhas, debates e enquetes pertencem a você. Você nos autoriza a armazená-los e exibi-los dentro do Bubo conforme as suas escolhas: o que é privado fica só com você; o que você publica em um clube aparece para os membros daquele clube, respeitando a proteção anti-spoiler. Na página de um livro do catálogo, o Bubo mostra apenas números agregados e anônimos de todos os leitores (quantos leram, estão lendo, querem ler ou largaram, a média das notas a partir de 5 avaliações e “quem leu também leu” a partir de 3 leitores); nunca nomes, nem a nota ou a estante de alguém.',
        'Você é responsável pelo que publica. Não publique textos de terceiros protegidos por direitos autorais além de citações curtas.',
      ],
    },
    {
      heading: '4. Regras da comunidade',
      paragraphs: [
        'Os clubes existem para conversar sobre livros com respeito. Conteúdos além da página marcada ficam cobertos automaticamente; cabe a você marcar a página certa ao publicar.',
      ],
      bullets: [
        'Sem assédio, discurso de ódio, ameaças ou conteúdo ilegal.',
        'Sem spam, propaganda ou links enganosos.',
        'Denúncias e bloqueios estão disponíveis em todo conteúdo. Três denúncias ocultam um item até a revisão do criador do clube.',
        'Podemos remover conteúdo e suspender ou encerrar contas que violem estas regras, com aviso quando possível.',
      ],
    },
    {
      heading: '5. O que o Bubo não promete',
      paragraphs: [
        'O Bubo é oferecido como está, sem garantia de disponibilidade contínua ou de ausência de erros. Fazemos o possível para manter o serviço no ar e seus dados seguros.',
      ],
      bullets: [
        'As informações de catálogo (títulos, autores, capas, páginas) vêm de fontes públicas e podem conter imprecisões; você pode corrigir a contagem de páginas de um livro na sua estante.',
        'Sequência, XP e revisões são calculados apenas a partir da sua atividade registrada. Revisar ajuda a lembrar, mas nenhum app garante retenção.',
        'A pergunta opcional sugerida por inteligência artificial é uma sugestão de reflexão, não uma avaliação do que você entendeu.',
      ],
    },
    {
      heading: '6. Encerramento',
      paragraphs: [
        'Você pode parar de usar o Bubo e excluir sua conta quando quiser. Podemos encerrar contas que violem estes termos ou descontinuar o serviço, avisando com antecedência sempre que possível.',
      ],
    },
    {
      heading: '7. Mudanças nestes termos',
      paragraphs: [
        'Quando estes termos mudarem, avisaremos no app ou por e-mail. A data no topo indica a versão vigente. Continuar usando o Bubo após o aviso significa concordar com a nova versão.',
      ],
    },
    {
      heading: '8. Lei aplicável e contato',
      paragraphs: [
        'Estes termos seguem a legislação brasileira, inclusive o Código de Defesa do Consumidor e a Lei Geral de Proteção de Dados (LGPD). Dúvidas e pedidos podem ser enviados pelo contato indicado em Configurações → Sobre.',
      ],
    },
  ],
};

export const PRIVACY_POLICY: LegalDoc = {
  title: 'Política de Privacidade',
  updatedAt: LEGAL_UPDATED_AT,
  intro:
    'Esta política explica quais dados o Bubo guarda, para quê, com quem compartilha e quais escolhas você tem. Resumo: guardamos o que é preciso para o app funcionar, não vendemos dados, não usamos para publicidade e você pode apagar tudo a qualquer momento.',
  sections: [
    {
      heading: '1. Quais dados existem',
      paragraphs: ['O Bubo guarda apenas o que você informa ou produz usando o app:'],
      bullets: [
        'Conta: nome, e-mail, senha (guardada como hash, nunca em texto) e se o e-mail foi confirmado.',
        'Leitura: livros da estante, páginas, sessões de leitura (início, fim, minutos de foco, páginas), reflexões, exercícios de recordação, notas de revisão e avaliações privadas dos livros.',
        'Preferências e consentimentos: ritmo de revisões, metas, lembretes, avisos no celular, e-mails opcionais e fuso horário do aparelho.',
        'Comunidade: clubes, debates, resenhas, enquetes, reações, amizades, bloqueios e denúncias.',
        'Técnicos: endereço IP e identificação do aparelho nas sessões de acesso e nos limites de uso, para segurança; token de notificações quando você ativa os avisos no celular.',
      ],
    },
    {
      heading: '2. Para que usamos',
      paragraphs: [],
      bullets: [
        'Fazer o app funcionar: sincronizar sua estante, sessões e revisões entre aparelhos.',
        'Calcular sequência, XP, revisões e conquistas somente a partir da sua atividade real.',
        'Mostrar números agregados e anônimos de cada livro do catálogo (leitores por status, média de notas e livros lidos em comum), sempre com um mínimo de leitores e sem identificar ninguém.',
        'Enviar os e-mails da conta: código de entrada, código para nova senha, aviso de senha alterada, boas-vindas e confirmação de exclusão.',
        'Enviar avisos opcionais, apenas com seu consentimento: notificações no celular e o lembrete de leitura por e-mail.',
        'Proteger sua conta: código em aparelhos novos, limites de tentativas e aparelhos lembrados.',
        'Manter a comunidade segura: proteção anti-spoiler, denúncias, bloqueios e moderação.',
      ],
    },
    {
      heading: '3. Bases legais (LGPD)',
      paragraphs: [],
      bullets: [
        'Execução do contrato: tudo o que é necessário para o Bubo funcionar para você.',
        'Consentimento: avisos no celular, lembrete de leitura por e-mail e a pergunta opcional de inteligência artificial. Você pode revogar cada um em Configurações.',
        'Legítimo interesse: segurança, prevenção a abusos e moderação da comunidade.',
        'Obrigação legal: quando a lei exigir.',
      ],
    },
    {
      heading: '4. Com quem compartilhamos',
      paragraphs: [
        'Não vendemos seus dados nem os usamos para publicidade. Usamos fornecedores que processam dados em nosso nome e sob contrato:',
      ],
      bullets: [
        'Cloudflare: hospedagem da API e armazenamento de capas de livros.',
        'Neon: banco de dados.',
        'Resend: envio dos e-mails do Bubo.',
        'Expo: entrega das notificações no celular (recebe apenas o token do aparelho e o texto do aviso, que nunca inclui suas notas).',
        'Google Books e Open Library: busca de livros. Recebem somente o texto da busca ou o ISBN, nunca sua identidade.',
        'Google Gemini: somente quando você pede a pergunta opcional ao fim de uma sessão. Recebe um trecho do seu próprio texto daquela sessão, nunca seu nome ou e-mail.',
      ],
    },
    {
      heading: '5. Por quanto tempo',
      paragraphs: [
        'Seus dados ficam guardados enquanto sua conta existir. Excluir a conta (Configurações → Conta e segurança → Excluir conta) apaga a conta, a estante, as sessões, as reflexões, os cartões, as preferências e o seu conteúdo na comunidade, de forma definitiva.',
        'Registros técnicos de acesso são mantidos por tempo limitado, apenas para segurança e diagnóstico.',
      ],
    },
    {
      heading: '6. Seus direitos',
      paragraphs: ['A LGPD garante a você, entre outros, os direitos de:'],
      bullets: [
        'Acessar e corrigir seus dados: no próprio app (perfil, estante, preferências).',
        'Excluir seus dados: no próprio app, a qualquer momento.',
        'Revogar consentimentos: em Configurações → Notificações no celular e → E-mails do Bubo. Cada e-mail opcional também traz um link para parar de receber.',
        'Pedir uma cópia dos seus dados (portabilidade) e informações sobre compartilhamentos: pelo contato indicado em Configurações → Sobre.',
      ],
    },
    {
      heading: '7. Segurança',
      paragraphs: [],
      bullets: [
        'Toda a comunicação usa HTTPS.',
        'Senhas são guardadas apenas como hash; códigos de entrada são guardados como hash, valem 10 minutos e funcionam uma só vez.',
        'A sessão fica no armazenamento seguro do aparelho e nunca é registrada em logs.',
        'Textos privados nunca entram em notificações, e-mails ou registros de moderação.',
      ],
    },
    {
      heading: '8. Crianças',
      paragraphs: [
        'O Bubo não é destinado a menores de 13 anos e não coleta intencionalmente dados dessa faixa etária. Se isso acontecer, apagaremos a conta assim que soubermos.',
      ],
    },
    {
      heading: '9. Mudanças e contato',
      paragraphs: [
        'Quando esta política mudar, avisaremos no app ou por e-mail; a data no topo indica a versão vigente. Para exercer seus direitos ou tirar dúvidas, use o contato indicado em Configurações → Sobre.',
      ],
    },
  ],
};
