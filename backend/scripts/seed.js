const mongoose = require('mongoose');
require('dotenv').config();

const Book = require('../src/models/Book');
const ClubDiscussion = require('../src/models/ClubDiscussion');
const ClubMembership = require('../src/models/ClubMembership');
const DeepReview = require('../src/models/DeepReview');
const ReadingClub = require('../src/models/ReadingClub');
const SocialActivity = require('../src/models/SocialActivity');
const SocialComment = require('../src/models/SocialComment');
const SocialInteraction = require('../src/models/SocialInteraction');
const User = require('../src/models/User');
const UserBook = require('../src/models/UserBook');
const UserFollow = require('../src/models/UserFollow');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bubo';
const DEMO_EMAIL = process.env.SEED_DEMO_EMAIL || 'demo@bubo.local';
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD;

if (!DEMO_PASSWORD) {
  throw new Error('SEED_DEMO_PASSWORD is required to create demonstration accounts.');
}

const AVATARS = {
  demo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=85',
  community: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&h=256&q=85',
  ana: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&h=256&q=85',
  lucas: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&h=256&q=85',
  marina: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&h=256&q=85',
};

const coverForIsbn = (isbn) => `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;

async function ensureUser({ username, email, ...profile }) {
  let user = await User.findOne({ email });
  if (!user) {
    user = new User({ username, email, password: DEMO_PASSWORD, ...profile });
    await user.save();
    return user;
  }

  Object.assign(user, profile);
  if (process.env.SEED_RESET_PASSWORD === 'true') user.password = DEMO_PASSWORD;
  await user.save();
  return user;
}

const ensureBook = ({ isbn, googleBooksId, ...data }) => Book.findOneAndUpdate(
  {
    $or: [
      { canonicalId: `isbn:${isbn}` },
      { googleBooksId },
      { isbn },
    ],
  },
  {
    $set: {
      canonicalId: `isbn:${isbn}`,
      googleBooksId,
      isbn,
      coverImage: coverForIsbn(isbn),
      pagesSource: 'manual',
      metadataConfidence: 'high',
      metadataSources: ['open_library', 'manual'],
      ...data,
    },
  },
  { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
);

const ensureUserBook = (user, book, status, currentPage) => UserBook.findOneAndUpdate(
  { userId: user._id, bookId: book._id },
  {
    $set: { status, currentPage, updatedAt: new Date() },
    $setOnInsert: { addedAt: new Date() },
  },
  { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
);

const ensureFollow = (follower, following) => UserFollow.updateOne(
  { followerId: follower._id, followingId: following._id },
  { $setOnInsert: { followerId: follower._id, followingId: following._id } },
  { upsert: true },
);

async function ensureReview({ user, userBook, pageFrom, pageTo, depth, feedback, retentionPrompt }) {
  const comprehension = Math.min(25, Math.round(depth * 0.28));
  const specificity = Math.min(25, Math.round(depth * 0.22));
  const connections = Math.min(25, Math.round(depth * 0.25));
  const reflection = Math.min(25, depth - comprehension - specificity - connections);
  const aiResponse = {
    state: 'APPROVED',
    cognitiveDepth: depth,
    criteria: { comprehension, specificity, connections, reflection },
    feedback,
    encouragement: 'Você transformou o trecho em uma conexão que pode permanecer.',
    strengths: ['Boa compreensão do conflito central.', 'Conexões claras entre ideias e consequências.'],
    nextSteps: ['Continue usando evidências concretas para sustentar sua interpretação.'],
    socraticQuestion: 'Que detalhe do trecho mais altera sua interpretação do personagem?',
    retentionPrompt,
    meta: {
      provider: 'seed',
      model: 'bubo-demonstration-data',
      evaluationVersion: '3.0',
      mode: 'demonstration',
      connected: false,
      degraded: false,
    },
  };
  const reviewText = `${feedback} Esta síntese foi incluída pelo seed demonstrativo para apresentar o histórico cognitivo com dados reproduzíveis.`;

  return DeepReview.findOneAndUpdate(
    { userId: user._id, userBookId: userBook._id, pageFrom, pageTo },
    {
      $set: {
        reviewText,
        cognitiveDepth: depth,
        status: 'approved',
        aiProvider: 'seed',
        aiModel: 'bubo-demonstration-data',
        evaluationVersion: '3.0',
        wordCount: 132,
        aiResponse,
      },
      $setOnInsert: { userId: user._id, userBookId: userBook._id, pageFrom, pageTo },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
}

const ensureActivity = (user, book, message, insight, postType = 'free') => SocialActivity.findOneAndUpdate(
  { userId: user._id, message },
  {
    $set: {
      userId: user._id,
      type: 'post',
      postType,
      bookId: book?._id,
      message,
      insight,
      cognitiveDepth: 0,
      pages: 0,
    },
  },
  { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
);

async function run() {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('Connected to MongoDB for seed.');

  const profiles = [
    {
      key: 'demo',
      username: 'leitor_demo',
      email: DEMO_EMAIL,
      bio: 'Explorando livros para lembrar, conectar e conversar melhor.',
      readingGoal: 20,
      preferences: ['Ficção científica', 'Filosofia', 'Ficção literária'],
      primaryGoal: 'retain',
      pace: 'steady',
    },
    {
      key: 'community',
      username: 'bubo_comunidade',
      email: 'community@bubo.local',
      bio: 'Ideias, clubes e leituras compartilhadas pela comunidade Bubo.',
      readingGoal: 30,
      preferences: ['Ficção científica', 'História', 'Filosofia'],
      primaryGoal: 'community',
      pace: 'intensive',
    },
    {
      key: 'ana',
      username: 'ana_entrelinhas',
      email: 'ana@bubo.local',
      bio: 'Leitora de ficção literária, memória e narradores pouco confiáveis.',
      readingGoal: 24,
      preferences: ['Ficção literária', 'Clássicos', 'Filosofia'],
      primaryGoal: 'reflect',
      pace: 'steady',
    },
    {
      key: 'lucas',
      username: 'lucas_cosmos',
      email: 'lucas@bubo.local',
      bio: 'Ficção científica, tecnologia e as consequências sociais das grandes ideias.',
      readingGoal: 18,
      preferences: ['Ficção científica', 'Tecnologia', 'Filosofia'],
      primaryGoal: 'retain',
      pace: 'intensive',
    },
    {
      key: 'marina',
      username: 'marina_leitora',
      email: 'marina@bubo.local',
      bio: 'Leituras sobre comportamento, escolhas e transformação pessoal.',
      readingGoal: 15,
      preferences: ['Ficção literária', 'Psicologia', 'Filosofia'],
      primaryGoal: 'community',
      pace: 'casual',
    },
  ];

  const users = {};
  for (const profile of profiles) {
    users[profile.key] = await ensureUser({
      username: profile.username,
      email: profile.email,
      avatar: AVATARS[profile.key],
      bio: profile.bio,
      readingGoal: profile.readingGoal,
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
      readingPreferences: {
        primaryGoal: profile.primaryGoal,
        pace: profile.pace,
        favoriteGenres: profile.preferences,
        weeklyReviewTarget: profile.pace === 'intensive' ? 4 : 2,
      },
    });
  }

  const books = {
    dune: await ensureBook({
      isbn: '9780441172719',
      googleBooksId: 'bubo-seed-dune',
      title: 'Duna',
      author: 'Frank Herbert',
      totalPages: 412,
      description: 'Política, ecologia e poder em Arrakis.',
      publisher: 'Ace',
      publishedDate: '1965',
      language: 'pt',
      categories: ['Ficção científica'],
    }),
    nineteen: await ensureBook({
      isbn: '9780451524935',
      googleBooksId: 'bubo-seed-1984',
      title: '1984',
      author: 'George Orwell',
      totalPages: 328,
      description: 'Linguagem, vigilância e controle da realidade.',
      publisher: 'Signet Classics',
      publishedDate: '1949',
      language: 'pt',
      categories: ['Ficção literária', 'Distopia'],
    }),
    dom: await ensureBook({
      isbn: '9788535910663',
      googleBooksId: 'bubo-seed-dom-casmurro',
      title: 'Dom Casmurro',
      author: 'Machado de Assis',
      totalPages: 256,
      description: 'Memória, ciúme e a instabilidade do narrador.',
      publisher: 'Companhia das Letras',
      publishedDate: '1899',
      language: 'pt',
      categories: ['Clássicos', 'Ficção literária'],
    }),
    alchemist: await ensureBook({
      isbn: '9780061122415',
      googleBooksId: 'bubo-seed-alchemist',
      title: 'O Alquimista',
      author: 'Paulo Coelho',
      totalPages: 208,
      description: 'Uma jornada sobre propósito, escolhas e transformação.',
      publisher: 'HarperOne',
      publishedDate: '1988',
      language: 'pt',
      categories: ['Ficção literária'],
    }),
  };

  const demoDune = await ensureUserBook(users.demo, books.dune, 'reading', 138);
  const demoNineteen = await ensureUserBook(users.demo, books.nineteen, 'read', 328);
  await Promise.all([
    ensureUserBook(users.demo, books.dom, 'to-read', 0),
    ensureUserBook(users.community, books.nineteen, 'reading', 172),
    ensureUserBook(users.ana, books.dom, 'reading', 96),
    ensureUserBook(users.ana, books.nineteen, 'to-read', 0),
    ensureUserBook(users.lucas, books.dune, 'reading', 211),
    ensureUserBook(users.lucas, books.nineteen, 'read', 328),
    ensureUserBook(users.marina, books.alchemist, 'reading', 76),
    ensureUserBook(users.marina, books.dom, 'to-read', 0),
  ]);

  const duneReview = await ensureReview({
    user: users.demo,
    userBook: demoDune,
    pageFrom: 101,
    pageTo: 138,
    depth: 84,
    feedback: 'A síntese conecta escassez, autoridade e decisões pessoais sem reduzir o trecho a um resumo do enredo.',
    retentionPrompt: 'Como o controle da água transforma relações políticas em Arrakis?',
  });
  const nineteenReview = await ensureReview({
    user: users.demo,
    userBook: demoNineteen,
    pageFrom: 301,
    pageTo: 328,
    depth: 89,
    feedback: 'A reflexão explica como linguagem, memória e poder convergem para limitar aquilo que pode ser pensado.',
    retentionPrompt: 'Por que controlar o passado altera as possibilidades do presente?',
  });

  await Promise.all([
    UserBook.updateOne(
      { _id: demoDune._id, 'deepReviews.pageFrom': { $ne: duneReview.pageFrom } },
      { $push: { deepReviews: {
        pageFrom: duneReview.pageFrom,
        pageTo: duneReview.pageTo,
        reviewText: duneReview.reviewText,
        cognitiveDepth: duneReview.cognitiveDepth,
        status: duneReview.status,
        aiResponse: duneReview.aiResponse,
        createdAt: duneReview.createdAt,
      } } },
    ),
    UserBook.updateOne(
      { _id: demoNineteen._id, 'deepReviews.pageFrom': { $ne: nineteenReview.pageFrom } },
      { $push: { deepReviews: {
        pageFrom: nineteenReview.pageFrom,
        pageTo: nineteenReview.pageTo,
        reviewText: nineteenReview.reviewText,
        cognitiveDepth: nineteenReview.cognitiveDepth,
        status: nineteenReview.status,
        aiResponse: nineteenReview.aiResponse,
        createdAt: nineteenReview.createdAt,
      } } },
    ),
  ]);

  const communityPost = await ensureActivity(
    users.community,
    books.nineteen,
    'Que livro mudou sua forma de perceber poder e linguagem?',
    'Uma pergunta ganha profundidade quando conectamos a resposta a uma passagem concreta.',
  );
  const anaPost = await ensureActivity(
    users.ana,
    books.dom,
    'Narradores pouco confiáveis mudam a leitura porque transformam memória em argumento.',
    'Lembrar também é escolher como organizar o passado.',
    'review',
  );
  const lucasPost = await ensureActivity(
    users.lucas,
    books.dune,
    'Em Duna, ecologia e política não são temas separados.',
    'Controlar um recurso natural também organiza o campo de possibilidades sociais.',
    'review',
  );

  await Promise.all([
    ensureFollow(users.demo, users.community),
    ensureFollow(users.community, users.ana),
    ensureFollow(users.community, users.lucas),
    ensureFollow(users.ana, users.marina),
    ensureFollow(users.lucas, users.ana),
    ensureFollow(users.marina, users.community),
    SocialInteraction.updateOne(
      { activityId: communityPost._id, userId: users.demo._id, kind: 'like' },
      { $setOnInsert: { activityId: communityPost._id, userId: users.demo._id, kind: 'like' } },
      { upsert: true },
    ),
    SocialInteraction.updateOne(
      { activityId: anaPost._id, userId: users.community._id, kind: 'like' },
      { $setOnInsert: { activityId: anaPost._id, userId: users.community._id, kind: 'like' } },
      { upsert: true },
    ),
    SocialInteraction.updateOne(
      { activityId: lucasPost._id, userId: users.ana._id, kind: 'save' },
      { $setOnInsert: { activityId: lucasPost._id, userId: users.ana._id, kind: 'save' } },
      { upsert: true },
    ),
    SocialComment.findOneAndUpdate(
      {
        activityId: communityPost._id,
        userId: users.demo._id,
        body: 'Duna me fez perceber como recursos naturais também organizam relações sociais.',
      },
      { $setOnInsert: {
        activityId: communityPost._id,
        userId: users.demo._id,
        body: 'Duna me fez perceber como recursos naturais também organizam relações sociais.',
      } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
  ]);

  const club = await ReadingClub.findOneAndUpdate(
    { ownerId: users.demo._id, name: 'Expedição por Arrakis' },
    { $set: {
      description: 'Leitura coletiva de Duna com discussões contextualizadas por páginas.',
      ownerId: users.demo._id,
      bookId: books.dune._id,
      visibility: 'public',
      memberLimit: 30,
      startDate: new Date(),
      targetDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      isArchived: false,
    } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );

  await Promise.all([
    ClubMembership.findOneAndUpdate(
      { clubId: club._id, userId: users.demo._id },
      { $set: { role: 'owner', currentPage: 138 } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ),
    ClubMembership.findOneAndUpdate(
      { clubId: club._id, userId: users.community._id },
      { $set: { role: 'member', currentPage: 96 } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ),
    ClubMembership.findOneAndUpdate(
      { clubId: club._id, userId: users.lucas._id },
      { $set: { role: 'member', currentPage: 211 } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ),
    ClubDiscussion.findOneAndUpdate(
      {
        clubId: club._id,
        userId: users.community._id,
        body: 'A escassez de água funciona como tecnologia política, não apenas como cenário.',
      },
      { $setOnInsert: {
        clubId: club._id,
        userId: users.community._id,
        body: 'A escassez de água funciona como tecnologia política, não apenas como cenário.',
        insight: 'Quem controla a necessidade básica também controla o horizonte de escolha.',
        pageFrom: 70,
        pageTo: 96,
      } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ),
  ]);

  console.log('Seed completed successfully.');
  console.log(`Demo login: ${DEMO_EMAIL}`);
};

run()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
