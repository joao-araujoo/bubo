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
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'BuboDemo123!';

const AVATARS = {
  demo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=85',
  community: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&h=256&q=85',
  ana: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&h=256&q=85',
  lucas: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&h=256&q=85',
  marina: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&h=256&q=85',
};

const coverForIsbn = (isbn) => `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;

const ensureUser = async ({ username, email, password, ...profile }) => {
  let user = await User.findOne({ email });
  if (!user) {
    user = new User({ username, email, password, ...profile });
    await user.save();
    return user;
  }

  Object.assign(user, profile);
  if (process.env.SEED_RESET_PASSWORD === 'true') user.password = password;
  await user.save();
  return user;
};

const ensureBook = ({ isbn, ...data }) => Book.findOneAndUpdate(
  { canonicalId: `isbn:${isbn}` },
  {
    $set: {
      canonicalId: `isbn:${isbn}`,
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

const ensureReview = async ({ user, userBook, pageFrom, pageTo, depth, feedback, retentionPrompt }) => {
  const criteria = {
    comprehension: Math.min(25, Math.round(depth * 0.28)),
    specificity: Math.min(25, Math.round(depth * 0.22)),
    connections: Math.min(25, Math.round(depth * 0.25)),
    reflection: Math.min(25, depth - Math.round(depth * 0.28) - Math.round(depth * 0.22) - Math.round(depth * 0.25)),
  };
  const aiResponse = {
    state: 'APPROVED',
    cognitiveDepth: depth,
    criteria,
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
  const reviewText = `${feedback} Esta síntese foi incluída pelo seed demonstrativo para apresentar o histórico cognitivo com dados realistas e reproduzíveis.`;

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
};

const ensureActivity = (query, data) => SocialActivity.findOneAndUpdate(
  query,
  { $set: data },
  { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
);

const run = async () => {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('Connected to MongoDB for seed.');

  const [demoUser, communityUser, anaUser, lucasUser, marinaUser] = await Promise.all([
    ensureUser({
      username: 'leitor_demo',
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      avatar: AVATARS.demo,
      bio: 'Explorando livros para lembrar, conectar e conversar melhor.',
      readingGoal: 20,
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
      readingPreferences: {
        primaryGoal: 'retain',
        pace: 'steady',
        favoriteGenres: ['Ficção científica', 'Filosofia', 'Ficção literária'],
        weeklyReviewTarget: 2,
      },
    }),
    ensureUser({
      username: 'bubo_comunidade',
      email: 'community@bubo.local',
      password: 'CommunityDemo123!',
      avatar: AVATARS.community,
      bio: 'Ideias, clubes e leituras compartilhadas pela comunidade Bubo.',
      readingGoal: 30,
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
      readingPreferences: {
        primaryGoal: 'community',
        pace: 'intensive',
        favoriteGenres: ['Ficção científica', 'História', 'Filosofia'],
        weeklyReviewTarget: 4,
      },
    }),
    ensureUser({
      username: 'ana_entrelinhas',
      email: 'ana@bubo.local',
      password: 'ReaderDemo123!',
      avatar: AVATARS.ana,
      bio: 'Leitora de ficção literária, memória e narradores pouco confiáveis.',
      readingGoal: 24,
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
      readingPreferences: {
        primaryGoal: 'reflect',
        pace: 'steady',
        favoriteGenres: ['Ficção literária', 'Clássicos', 'Filosofia'],
        weeklyReviewTarget: 3,
      },
    }),
    ensureUser({
      username: 'lucas_cosmos',
      email: 'lucas@bubo.local',
      password: 'ReaderDemo123!',
      avatar: AVATARS.lucas,
      bio: 'Ficção científica, tecnologia e as consequências sociais das grandes ideias.',
      readingGoal: 18,
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
      readingPreferences: {
        primaryGoal: 'retain',
        pace: 'intensive',
        favoriteGenres: ['Ficção científica', 'Tecnologia', 'Filosofia'],
        weeklyReviewTarget: 4,
      },
    }),
    ensureUser({
      username: 'marina_leitora',
      email: 'marina@bubo.local',
      password: 'ReaderDemo123!',
      avatar: AVATARS.marina,
      bio: 'Leituras sobre comportamento, escolhas e transformação pessoal.',
      readingGoal: 15,
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
      readingPreferences: {
        primaryGoal: 'community',
        pace: 'casual',
        favoriteGenres: ['Ficção literária', 'Psicologia', 'Filosofia'],
        weeklyReviewTarget: 2,
      },
    }),
  ]);

  const [dune, nineteenEightyFour, domCasmurro, alchemist] = await Promise.all([
    ensureBook({
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
    ensureBook({
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
    ensureBook({
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
    ensureBook({
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
  ]);

  const [duneUserBook, nineteenUserBook] = await Promise.all([
    ensureUserBook(demoUser, dune, 'reading', 138),
    ensureUserBook(demoUser, nineteenEightyFour, 'read', 328),
    ensureUserBook(demoUser, domCasmurro, 'to-read', 0),
    ensureUserBook(communityUser, nineteenEightyFour, 'reading', 172),
    ensureUserBook(anaUser, domCasmurro, 'reading', 96),
    ensureUserBook(anaUser, nineteenEightyFour, 'to-read', 0),
    ensureUserBook(lucasUser, dune, 'reading', 211),
    ensureUserBook(lucasUser, nineteenEightyFour, 'read', 328),
    ensureUserBook(marinaUser, alchemist, 'reading', 76),
    ensureUserBook(marinaUser, domCasmurro, 'to-read', 0),
  ]);

  const [duneReview, nineteenReview] = await Promise.all([
    ensureReview({
      user: demoUser,
      userBook: duneUserBook,
      pageFrom: 101,
      pageTo: 138,
      depth: 84,
      feedback: 'A síntese conecta escassez, autoridade e decisões pessoais sem reduzir o trecho a um resumo do enredo.',
      retentionPrompt: 'Como o controle da água transforma relações políticas em Arrakis?',
    }),
    ensureReview({
      user: demoUser,
      userBook: nineteenUserBook,
      pageFrom: 301,
      pageTo: 328,
      depth: 89,
      feedback: 'A reflexão explica como linguagem, memória e poder convergem para limitar aquilo que pode ser pensado.',
      retentionPrompt: 'Por que controlar o passado altera as possibilidades do presente?',
    }),
  ]);

  await Promise.all([
    UserBook.updateOne(
      { _id: duneUserBook._id, 'deepReviews.pageFrom': { $ne: duneReview.pageFrom } },
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
      { _id: nineteenUserBook._id, 'deepReviews.pageFrom': { $ne: nineteenReview.pageFrom } },
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

  const [communityPost, anaPost, lucasPost] = await Promise.all([
    ensureActivity(
      { userId: communityUser._id, message: 'Que livro mudou sua forma de perceber poder e linguagem?' },
      {
        userId: communityUser._id,
        type: 'post',
        postType: 'free',
        bookId: nineteenEightyFour._id,
        message: 'Que livro mudou sua forma de perceber poder e linguagem?',
        insight: 'Uma pergunta ganha profundidade quando conectamos a resposta a uma passagem concreta.',
        cognitiveDepth: 0,
        pages: 0,
      },
    ),
    ensureActivity(
      { userId: anaUser._id, message: 'Narradores pouco confiáveis mudam a leitura porque transformam memória em argumento.' },
      {
        userId: anaUser._id,
        type: 'post',
        postType: 'review',
        bookId: domCasmurro._id,
        message: 'Narradores pouco confiáveis mudam a leitura porque transformam memória em argumento.',
        insight: 'Lembrar também é escolher como organizar o passado.',
        cognitiveDepth: 0,
        pages: 0,
      },
    ),
    ensureActivity(
      { userId: lucasUser._id, message: 'Em Duna, ecologia e política não são temas separados.' },
      {
        userId: lucasUser._id,
        type: 'post',
        postType: 'review',
        bookId: dune._id,
        message: 'Em Duna, ecologia e política não são temas separados.',
        insight: 'Controlar um recurso natural também organiza o campo de possibilidades sociais.',
        cognitiveDepth: 0,
        pages: 0,
      },
    ),
  ]);

  await Promise.all([
    ensureFollow(demoUser, communityUser),
    ensureFollow(communityUser, anaUser),
    ensureFollow(communityUser, lucasUser),
    ensureFollow(anaUser, marinaUser),
    ensureFollow(lucasUser, anaUser),
    ensureFollow(marinaUser, communityUser),
    SocialInteraction.updateOne(
      { activityId: communityPost._id, userId: demoUser._id, kind: 'like' },
      { $setOnInsert: { activityId: communityPost._id, userId: demoUser._id, kind: 'like' } },
      { upsert: true },
    ),
    SocialInteraction.updateOne(
      { activityId: anaPost._id, userId: communityUser._id, kind: 'like' },
      { $setOnInsert: { activityId: anaPost._id, userId: communityUser._id, kind: 'like' } },
      { upsert: true },
    ),
    SocialInteraction.updateOne(
      { activityId: lucasPost._id, userId: anaUser._id, kind: 'save' },
      { $setOnInsert: { activityId: lucasPost._id, userId: anaUser._id, kind: 'save' } },
      { upsert: true },
    ),
    SocialComment.findOneAndUpdate(
      { activityId: communityPost._id, userId: demoUser._id, body: 'Duna me fez perceber como recursos naturais também organizam relações sociais.' },
      { $setOnInsert: {
        activityId: communityPost._id,
        userId: demoUser._id,
        body: 'Duna me fez perceber como recursos naturais também organizam relações sociais.',
      } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
  ]);

  const club = await ReadingClub.findOneAndUpdate(
    { ownerId: demoUser._id, name: 'Expedição por Arrakis' },
    { $set: {
      description: 'Leitura coletiva de Duna com discussões contextualizadas por páginas.',
      ownerId: demoUser._id,
      bookId: dune._id,
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
      { clubId: club._id, userId: demoUser._id },
      { $set: { role: 'owner', currentPage: 138 } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ),
    ClubMembership.findOneAndUpdate(
      { clubId: club._id, userId: communityUser._id },
      { $set: { role: 'member', currentPage: 96 } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ),
    ClubMembership.findOneAndUpdate(
      { clubId: club._id, userId: lucasUser._id },
      { $set: { role: 'member', currentPage: 211 } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ),
    ClubDiscussion.findOneAndUpdate(
      { clubId: club._id, userId: communityUser._id, body: 'A escassez de água funciona como tecnologia política, não apenas como cenário.' },
      { $setOnInsert: {
        clubId: club._id,
        userId: communityUser._id,
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
  console.log(`Demo password: ${DEMO_PASSWORD}`);
};

run()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
