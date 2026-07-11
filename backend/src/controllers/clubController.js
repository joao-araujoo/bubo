const crypto = require('crypto');
const Book = require('../models/Book');
const ClubDiscussion = require('../models/ClubDiscussion');
const ClubMembership = require('../models/ClubMembership');
const ReadingClub = require('../models/ReadingClub');
const UserBook = require('../models/UserBook');
const { normalizeClubProgress, normalizeDiscussionPages } = require('../services/clubs/clubRules');
const logger = require('../utils/logger');

const generateInviteCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();

const getClubOr404 = async (id) => ReadingClub.findOne({ _id: id, isArchived: false })
  .populate('bookId')
  .populate('ownerId', 'username avatar bio');

const getMembership = (clubId, userId) => ClubMembership.findOne({ clubId, userId });

const getClubStats = async (clubId) => {
  const [members, discussionsCount] = await Promise.all([
    ClubMembership.find({ clubId }).select('currentPage role').lean(),
    ClubDiscussion.countDocuments({ clubId }),
  ]);

  const memberCount = members.length;
  const pageTotal = members.reduce((sum, member) => sum + (Number(member.currentPage) || 0), 0);
  const averagePage = memberCount > 0 ? Math.round(pageTotal / memberCount) : 0;

  return { memberCount, averagePage, discussionsCount };
};

const serializeClub = async (club, currentUserId, options = {}) => {
  const [membership, stats] = await Promise.all([
    getMembership(club._id, currentUserId).lean(),
    getClubStats(club._id),
  ]);
  const totalPages = Number(club.bookId?.totalPages) || 0;
  const progressPercentage = totalPages > 0
    ? Math.min(100, Math.round((stats.averagePage / totalPages) * 100))
    : 0;

  const serialized = {
    _id: club._id,
    name: club.name,
    description: club.description,
    visibility: club.visibility,
    startDate: club.startDate,
    targetDate: club.targetDate,
    memberLimit: club.memberLimit,
    createdAt: club.createdAt,
    updatedAt: club.updatedAt,
    owner: club.ownerId,
    book: club.bookId,
    stats: { ...stats, progressPercentage },
    membership: membership
      ? {
          _id: membership._id,
          role: membership.role,
          currentPage: membership.currentPage,
          joinedAt: membership.joinedAt,
          lastActiveAt: membership.lastActiveAt,
        }
      : null,
    isMember: Boolean(membership),
  };

  if (options.includeInviteCode && membership && ['owner', 'moderator'].includes(membership.role)) {
    serialized.inviteCode = club.inviteCode;
  }

  if (options.includeLibraryEntry) {
    const libraryEntry = await UserBook.findOne({
      userId: currentUserId,
      bookId: club.bookId?._id,
    })
      .select('_id status currentPage totalPagesOverride')
      .lean();
    serialized.libraryEntry = libraryEntry || null;
  }

  return serialized;
};

exports.listClubs = async (req, res) => {
  try {
    const memberships = await ClubMembership.find({ userId: req.user._id }).select('clubId').lean();
    const memberClubIds = memberships.map((membership) => membership.clubId);
    const scope = String(req.query.scope || 'all');

    const query = { isArchived: false };
    if (scope === 'mine') {
      query._id = { $in: memberClubIds };
    } else if (scope === 'discover') {
      query.visibility = 'public';
      query._id = { $nin: memberClubIds };
    } else {
      query.$or = [
        { visibility: 'public' },
        { _id: { $in: memberClubIds } },
      ];
    }

    const clubs = await ReadingClub.find(query)
      .populate('bookId')
      .populate('ownerId', 'username avatar bio')
      .sort({ updatedAt: -1 })
      .limit(100);

    const serialized = await Promise.all(
      clubs.map((club) => serializeClub(club, req.user._id)),
    );

    return res.json({ clubs: serialized });
  } catch (error) {
    logger.error('club_list_failed', { requestId: req.requestId, error });
    return res.status(500).json({
      message: 'Não foi possível carregar os clubes agora.',
      code: 'CLUB_LIST_FAILED',
    });
  }
};

exports.createClub = async (req, res) => {
  const {
    name,
    description = '',
    bookId,
    visibility = 'public',
    startDate,
    targetDate,
    memberLimit = 30,
  } = req.body;

  let club;
  try {
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({
        message: 'O livro escolhido não foi encontrado.',
        code: 'CLUB_BOOK_NOT_FOUND',
      });
    }

    const userBook = await UserBook.exists({ userId: req.user._id, bookId: book._id });
    if (!userBook) {
      return res.status(400).json({
        message: 'Adicione este livro ao seu acervo antes de criar um clube.',
        code: 'CLUB_BOOK_NOT_IN_LIBRARY',
      });
    }

    const normalizedStartDate = startDate ? new Date(startDate) : new Date();
    const normalizedTargetDate = targetDate ? new Date(targetDate) : undefined;
    if (normalizedTargetDate && normalizedTargetDate <= normalizedStartDate) {
      return res.status(400).json({
        message: 'A meta de conclusão precisa ser posterior ao início.',
        code: 'CLUB_TARGET_DATE_INVALID',
      });
    }

    let inviteCode;
    if (visibility === 'private') {
      do {
        inviteCode = generateInviteCode();
      } while (await ReadingClub.exists({ inviteCode }));
    }

    club = await ReadingClub.create({
      name,
      description,
      bookId: book._id,
      ownerId: req.user._id,
      visibility,
      inviteCode,
      startDate: normalizedStartDate,
      targetDate: normalizedTargetDate,
      memberLimit,
    });

    try {
      await ClubMembership.create({
        clubId: club._id,
        userId: req.user._id,
        role: 'owner',
        currentPage: 0,
      });
    } catch (membershipError) {
      await ReadingClub.findByIdAndDelete(club._id);
      throw membershipError;
    }

    const populated = await getClubOr404(club._id);
    const serialized = await serializeClub(populated, req.user._id, {
      includeInviteCode: true,
      includeLibraryEntry: true,
    });
    return res.status(201).json({ club: serialized });
  } catch (error) {
    if (club?._id) await ReadingClub.findByIdAndDelete(club._id).catch(() => {});
    logger.error('club_create_failed', { requestId: req.requestId, error });
    return res.status(500).json({
      message: 'Não foi possível criar o clube. Nenhum dado parcial foi mantido.',
      code: 'CLUB_CREATE_FAILED',
    });
  }
};

exports.getClub = async (req, res) => {
  try {
    const club = await getClubOr404(req.params.id);
    if (!club) {
      return res.status(404).json({
        message: 'Este clube não foi encontrado ou não está mais disponível.',
        code: 'CLUB_NOT_FOUND',
      });
    }

    const membership = await getMembership(club._id, req.user._id);
    if (club.visibility === 'private' && !membership) {
      return res.status(403).json({
        message: 'Este é um clube privado. Use o código de convite para entrar.',
        code: 'CLUB_PRIVATE',
      });
    }

    const [serialized, memberships, discussions] = await Promise.all([
      serializeClub(club, req.user._id, {
        includeInviteCode: true,
        includeLibraryEntry: true,
      }),
      ClubMembership.find({ clubId: club._id })
        .populate('userId', 'username avatar bio')
        .sort({ role: 1, joinedAt: 1 })
        .lean(),
      ClubDiscussion.find({ clubId: club._id })
        .populate('userId', 'username avatar')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
    ]);

    serialized.members = memberships.map((item) => ({
      _id: item._id,
      user: item.userId,
      role: item.role,
      currentPage: item.currentPage,
      joinedAt: item.joinedAt,
      lastActiveAt: item.lastActiveAt,
      isCurrentUser: String(item.userId?._id) === String(req.user._id),
    }));

    serialized.discussions = discussions.map((discussion) => ({
      _id: discussion._id,
      user: discussion.userId,
      body: discussion.body,
      insight: discussion.insight,
      pageFrom: discussion.pageFrom,
      pageTo: discussion.pageTo,
      createdAt: discussion.createdAt,
      isOwn: String(discussion.userId?._id) === String(req.user._id),
    }));

    res.setHeader('Cache-Control', 'private, no-store');
    return res.json({ club: serialized });
  } catch (error) {
    logger.error('club_detail_failed', { requestId: req.requestId, clubId: req.params.id, error });
    return res.status(500).json({
      message: 'Não foi possível abrir este clube agora.',
      code: 'CLUB_DETAIL_FAILED',
    });
  }
};

exports.joinClub = async (req, res) => {
  try {
    const club = await getClubOr404(req.params.id);
    if (!club) {
      return res.status(404).json({
        message: 'Este clube não foi encontrado.',
        code: 'CLUB_NOT_FOUND',
      });
    }

    const existing = await getMembership(club._id, req.user._id);
    if (existing) {
      const serialized = await serializeClub(club, req.user._id, {
        includeInviteCode: true,
        includeLibraryEntry: true,
      });
      return res.json({ club: serialized });
    }

    if (club.visibility === 'private') {
      const inviteCode = String(req.body.inviteCode || '').trim().toUpperCase();
      if (!inviteCode || inviteCode !== club.inviteCode) {
        return res.status(403).json({
          message: 'O código de convite é inválido ou expirou.',
          code: 'CLUB_INVITE_INVALID',
        });
      }
    }

    const memberCount = await ClubMembership.countDocuments({ clubId: club._id });
    if (memberCount >= club.memberLimit) {
      return res.status(409).json({
        message: 'Este clube atingiu o limite de participantes.',
        code: 'CLUB_FULL',
      });
    }

    await ClubMembership.create({
      clubId: club._id,
      userId: req.user._id,
      role: 'member',
      currentPage: 0,
    });

    const serialized = await serializeClub(club, req.user._id, {
      includeInviteCode: true,
      includeLibraryEntry: true,
    });
    return res.status(201).json({ club: serialized });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Você já participa deste clube.',
        code: 'CLUB_ALREADY_JOINED',
      });
    }
    logger.error('club_join_failed', { requestId: req.requestId, clubId: req.params.id, error });
    return res.status(500).json({
      message: 'Não foi possível entrar no clube agora.',
      code: 'CLUB_JOIN_FAILED',
    });
  }
};

exports.leaveClub = async (req, res) => {
  try {
    const membership = await getMembership(req.params.id, req.user._id);
    if (!membership) {
      return res.status(404).json({
        message: 'Sua participação neste clube não foi encontrada.',
        code: 'CLUB_MEMBERSHIP_NOT_FOUND',
      });
    }
    if (membership.role === 'owner') {
      return res.status(400).json({
        message: 'O criador precisa transferir a responsabilidade antes de sair do clube.',
        code: 'CLUB_OWNER_CANNOT_LEAVE',
      });
    }

    await membership.deleteOne();
    return res.json({ success: true });
  } catch (error) {
    logger.error('club_leave_failed', { requestId: req.requestId, clubId: req.params.id, error });
    return res.status(500).json({
      message: 'Não foi possível sair do clube agora.',
      code: 'CLUB_LEAVE_FAILED',
    });
  }
};

exports.updateProgress = async (req, res) => {
  try {
    const club = await getClubOr404(req.params.id);
    if (!club) {
      return res.status(404).json({ message: 'Este clube não foi encontrado.', code: 'CLUB_NOT_FOUND' });
    }

    const membership = await getMembership(club._id, req.user._id);
    if (!membership) {
      return res.status(403).json({
        message: 'Entre no clube antes de atualizar o progresso.',
        code: 'CLUB_MEMBERSHIP_REQUIRED',
      });
    }

    membership.currentPage = normalizeClubProgress(req.body.currentPage, club.bookId?.totalPages);
    membership.lastActiveAt = new Date();
    await membership.save();

    const serialized = await serializeClub(club, req.user._id, {
      includeInviteCode: true,
      includeLibraryEntry: true,
    });
    return res.json({ club: serialized, membership });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ message: error.message, code: error.code });
    }
    logger.error('club_progress_failed', { requestId: req.requestId, clubId: req.params.id, error });
    return res.status(500).json({
      message: 'Não foi possível atualizar o progresso do clube.',
      code: 'CLUB_PROGRESS_FAILED',
    });
  }
};

exports.createDiscussion = async (req, res) => {
  const { body, insight = '' } = req.body;

  try {
    const club = await getClubOr404(req.params.id);
    if (!club) {
      return res.status(404).json({ message: 'Este clube não foi encontrado.', code: 'CLUB_NOT_FOUND' });
    }

    const membership = await getMembership(club._id, req.user._id);
    if (!membership) {
      return res.status(403).json({
        message: 'Entre no clube antes de participar das discussões.',
        code: 'CLUB_MEMBERSHIP_REQUIRED',
      });
    }

    const pages = normalizeDiscussionPages(req.body, club.bookId?.totalPages);
    const discussion = await ClubDiscussion.create({
      clubId: club._id,
      userId: req.user._id,
      body,
      insight,
      ...pages,
    });

    membership.lastActiveAt = new Date();
    await membership.save();

    const populated = await ClubDiscussion.findById(discussion._id)
      .populate('userId', 'username avatar');

    return res.status(201).json({
      discussion: {
        _id: populated._id,
        user: populated.userId,
        body: populated.body,
        insight: populated.insight,
        pageFrom: populated.pageFrom,
        pageTo: populated.pageTo,
        createdAt: populated.createdAt,
        isOwn: true,
      },
    });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ message: error.message, code: error.code });
    }
    logger.error('club_discussion_failed', { requestId: req.requestId, clubId: req.params.id, error });
    return res.status(500).json({
      message: 'Não foi possível publicar esta contribuição agora.',
      code: 'CLUB_DISCUSSION_FAILED',
    });
  }
};
