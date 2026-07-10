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

const upsertBook = (googleBooksId, data) => Book.findOneAndUpdate(
  { googleBooksId },
  { $set: { googleBooksId, ...data } },
  { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
);

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

const ensureReview = async ({ user, userBook, pageFrom, pageTo, depth, feedback, retentionPrompt }) => {
  const existing = await DeepReview.findOne({
    userId: user._id,
    userBookId: userBook._id,
    pageFrom,
    pageTo,
  });
  if (existing) return existing;

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
      provider: 'local',
      model: 'bubo-local-evaluator-v2',
      evaluationVersion: '2.0',
      mode: 'local',
      connected: false,
      degraded: false,
    },
  };

  return DeepReview.create({
    userId: user._id,
    userBookId: userBook._id,
    pageFrom,
    pageTo,
    reviewText: `${feedback} Esta síntese foi incluída pelo seed demonstrativo para apresentar o histórico cognitivo do Bubo com dados realistas e reproduzíveis.`,
    cognitiveDepth: depth,
    status: 'approved',
    aiProvider: 'local',
    aiModel: 'bubo-local-evaluator-v2',
    evaluationVersion: '2.0',
    wordCount: 132,
    aiResponse,
  });
};

const run = async () => {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('Connected to MongoDB for seed.');

  const [demoUser, communityUser] = await Promise.all([
    ensureUser({
      username: 'leitor_demo',
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
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
  ]);

  const [dune, nineteenEightyFour, domCasmurro] = await Promise.all([
    upsertBook('bubo-seed-dune', {
      title: 'Duna',
      author: 'Frank Herbert',
      totalPages: 412,
      description: 'Política, ecologia e poder em Arrakis.',
      isbn: '9780441172719',
    }),
    upsertBook('bubo-seed-1984', {
      title: '1984',
      author: 'George Orwell',
      totalPages: 328,
      description: 'Linguagem, vigilância e controle da realidade.',
      isbn: '9780451524935',
    }),
    upsertBook('bubo-seed-dom-casmurro', {
      title: 'Dom Casmurro',
      author: 'Machado de Assis',
      totalPages: 256,
      description: 'Memória, ciúme e a instabilidade do narrador.',
      isbn: '9788535910663',
    }),
  ]);

  const [duneUserBook, nineteenUserBook] = await Promise.all([
    UserBook.findOneAndUpdate(
      { userId: demoUser._id, bookId: dune._id },
      { $set: { status: 'reading', currentPage: 138, updatedAt: new Date() }, $setOnInsert: { addedAt: new Date() } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ),
    UserBook.findOneAndUpdate(
      { userId: demoUser._id, bookId: nineteenEightyFour._id },
      { $set: { status: 'read', currentPage: 328, updatedAt: new Date() }, $setOnInsert: { addedAt: new Date() } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ),
    UserBook.findOneAndUpdate(
      { userId: demoUser._id, bookId: domCasmurro._id },
      { $set: { status: 'to-read', currentPage: 0, updatedAt: new Date() }, $setOnInsert: { addedAt: new Date() } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ),
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

  await UserBook.updateOne(
    { _id: duneUserBook._id, 'deepReviews.pageFrom': { $ne: duneReview.pageFrom } },
    { $push: { deepReviews: {
      pageFrom: duneReview.pageFrom,
      pageTo: duneReview.pageTo,
      reviewText: duneReview.reviewText,
      cognitiveDepth: duneReview.cognitiveDepth,
      status: duneReview.status,
      aiResponse: duneReview.aiResponse,
      createdAt: duneReview.createdAt,
    } } }
  );
  await UserBook.updateOne(
    { _id: nineteenUserBook._id, 'deepReviews.pageFrom': { $ne: nineteenReview.pageFrom } },
    { $push: { deepReviews: {
      pageFrom: nineteenReview.pageFrom,
      pageTo: nineteenReview.pageTo,
      reviewText: nineteenReview.reviewText,
      cognitiveDepth: nineteenReview.cognitiveDepth,
      status: nineteenReview.status,
      aiResponse: nineteenReview.aiResponse,
      createdAt: nineteenReview.createdAt,
    } } }
  );

  const communityPost = await SocialActivity.findOneAndUpdate(
    { userId: communityUser._id, message: 'Que livro mudou sua forma de perceber poder e linguagem?' },
    { $setOnInsert: {
      userId: communityUser._id,
      type: 'post',
      postType: 'free',
      bookId: nineteenEightyFour._id,
      message: 'Que livro mudou sua forma de perceber poder e linguagem?',
      insight: 'Uma pergunta ganha profundidade quando conectamos a resposta a uma passagem concreta.',
      cognitiveDepth: 0,
      pages: 0,
    } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  await Promise.all([
    UserFollow.updateOne(
      { followerId: demoUser._id, followingId: communityUser._id },
      { $setOnInsert: { followerId: demoUser._id, followingId: communityUser._id } },
      { upsert: true }
    ),
    SocialInteraction.updateOne(
      { activityId: communityPost._id, userId: demoUser._id, kind: 'like' },
      { $setOnInsert: { activityId: communityPost._id, userId: demoUser._id, kind: 'like' } },
      { upsert: true }
    ),
    SocialInteraction.updateOne(
      { activityId: communityPost._id, userId: demoUser._id, kind: 'save' },
      { $setOnInsert: { activityId: communityPost._id, userId: demoUser._id, kind: 'save' } },
      { upsert: true }
    ),
    SocialComment.findOneAndUpdate(
      { activityId: communityPost._id, userId: demoUser._id, body: 'Duna me fez perceber como recursos naturais também organizam relações sociais.' },
      { $setOnInsert: {
        activityId: communityPost._id,
        userId: demoUser._id,
        body: 'Duna me fez perceber como recursos naturais também organizam relações sociais.',
      } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
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
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  await Promise.all([
    ClubMembership.findOneAndUpdate(
      { clubId: club._id, userId: demoUser._id },
      { $set: { role: 'owner', currentPage: 138 } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ),
    ClubMembership.findOneAndUpdate(
      { clubId: club._id, userId: communityUser._id },
      { $set: { role: 'member', currentPage: 96 } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
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
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
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
