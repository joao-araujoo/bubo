const crypto = require('crypto');
const Book = require('../models/Book');
const ReadingClub = require('../models/ReadingClub');
const ClubMembership = require('../models/ClubMembership');
const ClubDiscussion = require('../models/ClubDiscussion');

const generateInviteCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();

const getClubOr404 = async (id) => ReadingClub.findOne({ _id: id, isArchived: false })
  .populate('bookId')
  .populate('ownerId', 'username avatar bio');

const getMembership = (clubId, userId) => ClubMembership.findOne({ clubId, userId });

const getClubStats = async (clubId) => {
  const [members, discussionsCount] = await Promise.all([
    ClubMembership.find({ clubId }).select('currentPage role'),
    ClubDiscussion.countDocuments({ clubId })
  ]);

  const memberCount = members.length;
  const pageTotal = members.reduce((sum, member) => sum + (Number(member.currentPage) || 0), 0);
  const averagePage = memberCount > 0 ? Math.round(pageTotal / memberCount) : 0;

  return {
    memberCount,
    averagePage,
    discussionsCount
  };
};

const serializeClub = async (club, currentUserId, options = {}) => {
  const [membership, stats] = await Promise.all([
    getMembership(club._id, currentUserId),
    getClubStats(club._id)
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
    stats: {
      ...stats,
      progressPercentage
    },
    membership: membership
      ? {
          _id: membership._id,
          role: membership.role,
          currentPage: membership.currentPage,
          joinedAt: membership.joinedAt,
          lastActiveAt: membership.lastActiveAt
        }
      : null,
    isMember: Boolean(membership)
  };

  if (options.includeInviteCode && membership && ['owner', 'moderator'].includes(membership.role)) {
    serialized.inviteCode = club.inviteCode;
  }

  return serialized;
};

exports.listClubs = async (req, res) => {
  try {
    const memberships = await ClubMembership.find({ userId: req.user._id }).select('clubId');
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
        { _id: { $in: memberClubIds } }
      ];
    }

    const clubs = await ReadingClub.find(query)
      .populate('bookId')
      .populate('ownerId', 'username avatar bio')
      .sort({ updatedAt: -1 })
      .limit(100);

    const serialized = await Promise.all(
      clubs.map((club) => serializeClub(club, req.user._id))
    );

    res.json({ clubs: serialized });
  } catch (error) {
    res.status(500).json({ message: 'Failed to list reading clubs', error: error.message });
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
    memberLimit = 30
  } = req.body;

  try {
    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ message: 'Book not found' });

    const normalizedStartDate = startDate ? new Date(startDate) : new Date();
    const normalizedTargetDate = targetDate ? new Date(targetDate) : undefined;
    if (normalizedTargetDate && normalizedTargetDate <= normalizedStartDate) {
      return res.status(400).json({ message: 'Target date must be after the start date' });
    }

    let inviteCode;
    if (visibility === 'private') {
      do {
        inviteCode = generateInviteCode();
      } while (await ReadingClub.exists({ inviteCode }));
    }

    const club = await ReadingClub.create({
      name,
      description,
      bookId: book._id,
      ownerId: req.user._id,
      visibility,
      inviteCode,
      startDate: normalizedStartDate,
      targetDate: normalizedTargetDate,
      memberLimit
    });

    try {
      await ClubMembership.create({
        clubId: club._id,
        userId: req.user._id,
        role: 'owner',
        currentPage: 0
      });
    } catch (membershipError) {
      await ReadingClub.findByIdAndDelete(club._id);
      throw membershipError;
    }

    const populated = await getClubOr404(club._id);
    const serialized = await serializeClub(populated, req.user._id, { includeInviteCode: true });
    res.status(201).json({ club: serialized });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create reading club', error: error.message });
  }
};

exports.getClub = async (req, res) => {
  try {
    const club = await getClubOr404(req.params.id);
    if (!club) return res.status(404).json({ message: 'Reading club not found' });

    const membership = await getMembership(club._id, req.user._id);
    if (club.visibility === 'private' && !membership) {
      return res.status(403).json({ message: 'This is a private reading club' });
    }

    const [serialized, memberships, discussions] = await Promise.all([
      serializeClub(club, req.user._id, { includeInviteCode: true }),
      ClubMembership.find({ clubId: club._id })
        .populate('userId', 'username avatar bio')
        .sort({ role: 1, joinedAt: 1 }),
      ClubDiscussion.find({ clubId: club._id })
        .populate('userId', 'username avatar')
        .sort({ createdAt: -1 })
        .limit(100)
    ]);

    serialized.members = memberships.map((item) => ({
      _id: item._id,
      user: item.userId,
      role: item.role,
      currentPage: item.currentPage,
      joinedAt: item.joinedAt,
      lastActiveAt: item.lastActiveAt,
      isCurrentUser: String(item.userId?._id) === String(req.user._id)
    }));

    serialized.discussions = discussions.map((discussion) => ({
      _id: discussion._id,
      user: discussion.userId,
      body: discussion.body,
      insight: discussion.insight,
      pageFrom: discussion.pageFrom,
      pageTo: discussion.pageTo,
      createdAt: discussion.createdAt,
      isOwn: String(discussion.userId?._id) === String(req.user._id)
    }));

    res.json({ club: serialized });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get reading club', error: error.message });
  }
};

exports.joinClub = async (req, res) => {
  try {
    const club = await getClubOr404(req.params.id);
    if (!club) return res.status(404).json({ message: 'Reading club not found' });

    const existing = await getMembership(club._id, req.user._id);
    if (existing) {
      const serialized = await serializeClub(club, req.user._id, { includeInviteCode: true });
      return res.json({ club: serialized });
    }

    if (club.visibility === 'private') {
      const inviteCode = String(req.body.inviteCode || '').trim().toUpperCase();
      if (!inviteCode || inviteCode !== club.inviteCode) {
        return res.status(403).json({ message: 'Invalid invitation code' });
      }
    }

    const memberCount = await ClubMembership.countDocuments({ clubId: club._id });
    if (memberCount >= club.memberLimit) {
      return res.status(409).json({ message: 'This reading club is full' });
    }

    await ClubMembership.create({
      clubId: club._id,
      userId: req.user._id,
      role: 'member',
      currentPage: 0
    });

    const serialized = await serializeClub(club, req.user._id, { includeInviteCode: true });
    res.status(201).json({ club: serialized });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'You are already a member of this club' });
    }
    res.status(500).json({ message: 'Failed to join reading club', error: error.message });
  }
};

exports.leaveClub = async (req, res) => {
  try {
    const membership = await getMembership(req.params.id, req.user._id);
    if (!membership) return res.status(404).json({ message: 'Membership not found' });
    if (membership.role === 'owner') {
      return res.status(400).json({ message: 'The owner cannot leave the club without transferring ownership' });
    }

    await membership.deleteOne();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to leave reading club', error: error.message });
  }
};

exports.updateProgress = async (req, res) => {
  try {
    const club = await getClubOr404(req.params.id);
    if (!club) return res.status(404).json({ message: 'Reading club not found' });

    const membership = await getMembership(club._id, req.user._id);
    if (!membership) return res.status(403).json({ message: 'Only members can update club progress' });

    const requestedPage = Math.max(0, Number(req.body.currentPage) || 0);
    const totalPages = Number(club.bookId?.totalPages) || 0;
    membership.currentPage = totalPages > 0 ? Math.min(requestedPage, totalPages) : requestedPage;
    membership.lastActiveAt = new Date();
    await membership.save();

    const serialized = await serializeClub(club, req.user._id, { includeInviteCode: true });
    res.json({ club: serialized, membership });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update club progress', error: error.message });
  }
};

exports.createDiscussion = async (req, res) => {
  const { body, insight = '', pageFrom, pageTo } = req.body;

  try {
    const club = await getClubOr404(req.params.id);
    if (!club) return res.status(404).json({ message: 'Reading club not found' });

    const membership = await getMembership(club._id, req.user._id);
    if (!membership) return res.status(403).json({ message: 'Only members can participate in discussions' });

    const from = pageFrom === undefined || pageFrom === '' ? undefined : Math.max(0, Number(pageFrom) || 0);
    const to = pageTo === undefined || pageTo === '' ? undefined : Math.max(0, Number(pageTo) || 0);
    if (from !== undefined && to !== undefined && to < from) {
      return res.status(400).json({ message: 'The final page must be equal to or greater than the initial page' });
    }

    const totalPages = Number(club.bookId?.totalPages) || 0;
    if (totalPages > 0 && ((from !== undefined && from > totalPages) || (to !== undefined && to > totalPages))) {
      return res.status(400).json({ message: 'Discussion pages cannot exceed the total number of book pages' });
    }

    const discussion = await ClubDiscussion.create({
      clubId: club._id,
      userId: req.user._id,
      body,
      insight,
      pageFrom: from,
      pageTo: to
    });

    membership.lastActiveAt = new Date();
    await membership.save();

    const populated = await ClubDiscussion.findById(discussion._id)
      .populate('userId', 'username avatar');

    res.status(201).json({
      discussion: {
        _id: populated._id,
        user: populated.userId,
        body: populated.body,
        insight: populated.insight,
        pageFrom: populated.pageFrom,
        pageTo: populated.pageTo,
        createdAt: populated.createdAt,
        isOwn: true
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create discussion', error: error.message });
  }
};
