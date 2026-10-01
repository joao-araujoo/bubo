import {
  type AddBookRequest,
  type GlobalModerationRequest,
  type CreateCycleRequest,
  type FriendAction,
  type SocialPreferences,
  type CreateCardRequest,
  type CreateClubRequest,
  type CreatePollRequest,
  type ReactionRequest,
  type CreatePostRequest,
  type CreateReplyRequest,
  type ModerationRequest,
  type ReportRequest,
  type CreateSessionRequest,
  type MeResponse,
  type OnboardingRequest,
  type ReviewRequest,
  type UpdateShelfEntryRequest,
} from '@bubo/contracts';
import { toIsbn13, toLocalIsoDate } from '@bubo/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, ApiError } from './client';

/** Query keys live in one place so invalidation stays predictable. */
export const queryKeys = {
  system: {
    health: ['system', 'health'] as const,
  },
  /** Scoped by user id so a different account never sees cached data from the previous one. */
  me: (userId: string) => ['me', userId] as const,
  shelf: (userId: string) => ['shelf', userId] as const,
  shelfEntry: (userId: string, entryId: string) => ['shelf', userId, entryId] as const,
  stats: (userId: string, today: string) => ['stats', userId, today] as const,
  memory: (userId: string, today: string, days: number, tz: number) =>
    ['memory', userId, today, days, tz] as const,
  achievements: (userId: string, today: string) => ['achievements', userId, today] as const,
  clubs: (userId: string, q: string) => ['clubs', userId, 'list', q] as const,
  club: (userId: string, clubId: string) => ['clubs', userId, 'club', clubId] as const,
  clubPosts: (userId: string, clubId: string) => ['clubs', userId, 'posts', clubId] as const,
  clubTopic: (userId: string, clubId: string, postId: string, reveal: boolean) =>
    ['clubs', userId, 'topic', clubId, postId, reveal] as const,
  blocks: (userId: string) => ['blocks', userId] as const,
  communityFeed: (userId: string) => ['clubs', userId, 'feed'] as const,
  clubMembers: (userId: string, clubId: string) => ['clubs', userId, 'members', clubId] as const,
  clubPolls: (userId: string, clubId: string) => ['clubs', userId, 'polls', clubId] as const,
  clubPoll: (userId: string, clubId: string, pollId: string, reveal: boolean) =>
    ['clubs', userId, 'poll', clubId, pollId, reveal] as const,
  invite: (userId: string, code: string) => ['clubs', userId, 'invite', code] as const,
  due: (userId: string, today: string) => ['recall', userId, today] as const,
  catalogSearch: (userId: string, q: string) => ['catalog', userId, 'search-v2', q] as const,
  catalogBook: (userId: string, catalogId: string) =>
    ['catalog', userId, 'book', catalogId] as const,
  catalogIsbn: (userId: string, isbn: string) => ['catalog', userId, 'isbn', isbn] as const,
};

/** Normalized search text (the cache key and the request share it). */
export function normalizeCatalogQuery(q: string) {
  return toIsbn13(q) ?? q.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Catalog search. Results are cached for a day on the server and kept here for 30 minutes. */
export function useCatalogSearch(userId: string | undefined, q: string) {
  const query = normalizeCatalogQuery(q);
  return useQuery({
    queryKey: queryKeys.catalogSearch(userId ?? 'anonymous', query),
    queryFn: ({ signal }) => api.searchCatalog(query, signal),
    enabled: Boolean(userId) && query.length >= 2,
    staleTime: (state) =>
      !state.state.data?.results.length || Object.values(state.state.data.sources).includes('error')
        ? 60_000
        : 30 * 60_000,
    retry: (count, error) => count < 2 && error instanceof ApiError && error.retryable,
  });
}

/** Barcode lookup. isbn must already be a valid ISBN-13 (the scanner validates it). */
export function useIsbnLookup(userId: string | undefined, isbn: string | null) {
  return useQuery({
    queryKey: queryKeys.catalogIsbn(userId ?? 'anonymous', isbn ?? ''),
    queryFn: ({ signal }) => api.lookupIsbn(isbn ?? '', signal),
    enabled: userId !== undefined && userId !== '' && isbn !== null,
    staleTime: 10 * 60_000,
    retry: (count, error) => count < 2 && error instanceof ApiError && error.retryable,
  });
}

export function useCatalogBook(userId: string | undefined, catalogId: string) {
  return useQuery({
    queryKey: queryKeys.catalogBook(userId ?? 'anonymous', catalogId),
    queryFn: ({ signal }) => api.getCatalogBook(catalogId, signal),
    enabled: userId !== undefined && catalogId !== '',
    staleTime: 10 * 60_000,
  });
}

/** API liveness (used by the DEV showcase and diagnostics). */
export function useApiHealth(enabled = true) {
  return useQuery({
    queryKey: queryKeys.system.health,
    queryFn: ({ signal }) => api.getHealth(signal),
    enabled,
    staleTime: 30_000,
  });
}

/** The signed-in reader (profile + onboarding state). */
export function useMe(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.me(userId ?? 'anonymous'),
    queryFn: ({ signal }) => api.getMe(signal),
    enabled: userId !== undefined,
    staleTime: 5 * 60_000,
    // Gates navigation on launch: fail fast to the retry screen instead of a long splash.
    retry: 1,
  });
}

export function useShelf(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.shelf(userId ?? 'anonymous'),
    queryFn: ({ signal }) => api.getShelf(signal),
    enabled: userId !== undefined,
  });
}

export function useShelfEntry(userId: string | undefined, entryId: string) {
  return useQuery({
    queryKey: queryKeys.shelfEntry(userId ?? 'anonymous', entryId),
    queryFn: ({ signal }) => api.getShelfEntry(entryId, signal),
    enabled: userId !== undefined && entryId !== '',
  });
}

/** Stats for the reader's *local* today (streaks follow the device's calendar day). */
export function useStats(userId: string | undefined) {
  const today = toLocalIsoDate(new Date());
  return useQuery({
    queryKey: queryKeys.stats(userId ?? 'anonymous', today),
    queryFn: ({ signal }) => api.getStats(today, signal),
    enabled: userId !== undefined,
  });
}

/** "Minha memória" for the reader's local today, over 7/30/90/365 days, in the device's zone. */
export function useMemoryStats(userId: string | undefined, days: 7 | 30 | 90 | 365 = 7) {
  const now = new Date();
  const today = toLocalIsoDate(now);
  // getTimezoneOffset() is minutes *behind* UTC (BRT = 180); the API wants the UTC offset (−180).
  const tz = -now.getTimezoneOffset();
  return useQuery({
    queryKey: queryKeys.memory(userId ?? 'anonymous', today, days, tz),
    queryFn: ({ signal }) => api.getMemoryStats({ today, days, tz }, signal),
    enabled: Boolean(userId),
  });
}

/** Level + achievements for the reader's local today (recomputed from activity). */
export function useAchievements(userId: string | undefined) {
  const today = toLocalIsoDate(new Date());
  return useQuery({
    queryKey: queryKeys.achievements(userId ?? 'anonymous', today),
    queryFn: ({ signal }) => api.getAchievements(today, signal),
    enabled: Boolean(userId),
  });
}

/** Recall cards due on the reader's local today. */
export function useDueCards(userId: string | undefined) {
  const today = toLocalIsoDate(new Date());
  return useQuery({
    queryKey: queryKeys.due(userId ?? 'anonymous', today),
    queryFn: ({ signal }) => api.getDueCards(today, signal),
    enabled: userId !== undefined,
  });
}

/** Everything that depends on the shelf, sessions or reviews is refreshed together. */
function useInvalidateReading(userId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['shelf', userId] }),
      queryClient.invalidateQueries({ queryKey: ['stats', userId] }),
      queryClient.invalidateQueries({ queryKey: ['memory', userId] }),
      queryClient.invalidateQueries({ queryKey: ['achievements', userId] }),
      // Reading progress moves the anti-spoiler line in every club.
      queryClient.invalidateQueries({ queryKey: ['clubs', userId] }),
      queryClient.invalidateQueries({ queryKey: ['recall', userId] }),
      // "Já está na estante" on catalog screens.
      queryClient.invalidateQueries({ queryKey: ['catalog', userId, 'book'] }),
    ]);
}

export function useCreateCard(userId: string) {
  const invalidate = useInvalidateReading(userId);
  return useMutation({
    mutationFn: (body: CreateCardRequest) => api.createCard(body),
    onSuccess: invalidate,
  });
}

export function useDeleteCard(userId: string) {
  const invalidate = useInvalidateReading(userId);
  return useMutation({ mutationFn: (id: string) => api.deleteCard(id), onSuccess: invalidate });
}

/** Review mutations do NOT refetch the due list mid-session (the queue stays stable). */
export function useReviewCard() {
  return useMutation({
    mutationFn: ({ cardId, body }: { cardId: string; body: ReviewRequest }) =>
      api.reviewCard(cardId, body),
  });
}

export function useRefreshAfterReview(userId: string) {
  return useInvalidateReading(userId);
}

export function useAddBook(userId: string) {
  const invalidate = useInvalidateReading(userId);
  return useMutation({
    mutationFn: (body: AddBookRequest) => api.addBook(body),
    onSuccess: invalidate,
  });
}

export function useUpdateShelfEntry(userId: string, entryId: string) {
  const invalidate = useInvalidateReading(userId);
  return useMutation({
    mutationFn: (body: UpdateShelfEntryRequest) => api.updateShelfEntry(entryId, body),
    onSuccess: invalidate,
  });
}

export function useDeleteShelfEntry(userId: string, entryId: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateReading(userId);
  return useMutation({
    mutationFn: () => api.deleteShelfEntry(entryId),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: queryKeys.shelfEntry(userId, entryId) });
      await invalidate();
    },
  });
}

export function useRecordSession(userId: string) {
  const invalidate = useInvalidateReading(userId);
  return useMutation({
    mutationFn: (body: CreateSessionRequest) => api.recordSession(body),
    onSuccess: invalidate,
  });
}

/**
 * Saves onboarding. The `me` cache is NOT updated here on purpose: the "Pronto!" screen is shown
 * first, and `finishOnboarding` flips the navigation guard when the reader taps "Ir para o Bubo".
 */
export function useCompleteOnboarding(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: OnboardingRequest) => api.completeOnboarding(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shelf(userId) }),
  });
}

export function useFinishOnboarding(userId: string) {
  const queryClient = useQueryClient();
  return (me: MeResponse) => queryClient.setQueryData(queryKeys.me(userId), me);
}

// ---------------------------------------------------------------------------------------------
// Comunidade (Task 07)
// ---------------------------------------------------------------------------------------------

const MISSING_USER = 'anonymous';

/** The reader's clubs + public clubs to discover (optional search by name or book). */
export function useClubs(userId: string | undefined, q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: queryKeys.clubs(userId ?? MISSING_USER, term),
    queryFn: ({ signal }) => api.listClubs(term, signal),
    enabled: Boolean(userId),
  });
}

export function useClub(userId: string | undefined, clubId: string) {
  return useQuery({
    queryKey: queryKeys.club(userId ?? MISSING_USER, clubId),
    queryFn: ({ signal }) => api.getClub(clubId, signal),
    enabled: Boolean(userId) && clubId !== '',
  });
}

/** Topics — only fetched for members (the API answers 403 otherwise). */
export function useClubPosts(userId: string | undefined, clubId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.clubPosts(userId ?? MISSING_USER, clubId),
    queryFn: ({ signal }) => api.listClubPosts(clubId, signal),
    enabled: Boolean(userId) && clubId !== '' && enabled,
  });
}

export function useClubBookReviews(userId: string | undefined, clubId: string) {
  return useQuery({
    queryKey: ['clubs', userId ?? MISSING_USER, 'book-reviews', clubId],
    queryFn: ({ signal }) => api.listClubBookReviews(clubId, signal),
    enabled: Boolean(userId) && clubId !== '',
  });
}

export function useClubCycles(userId: string | undefined, clubId: string) {
  return useQuery({
    queryKey: ['clubs', userId, 'cycles', clubId],
    queryFn: ({ signal }) => api.listClubCycles(clubId, signal),
    enabled: Boolean(userId),
  });
}

export function useFriends(userId: string | undefined) {
  return useQuery({
    queryKey: ['friends', userId],
    queryFn: ({ signal }) => api.listFriends(signal),
    enabled: Boolean(userId),
  });
}
export function useFriendsFeed(userId: string | undefined) {
  return useQuery({
    queryKey: ['friends-feed', userId],
    queryFn: ({ signal }) => api.getFriendsFeed(signal),
    enabled: Boolean(userId),
    gcTime: 0,
    staleTime: 0,
  });
}
export function useChangeFriend(userId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ otherId, action }: { otherId: string; action: FriendAction }) =>
      api.changeFriend(otherId, action),
    onSuccess: async (data) => {
      client.setQueryData(['friends', userId], data);
      await client.invalidateQueries({ queryKey: ['friends-feed', userId] });
    },
  });
}
export function useSaveSocialPreferences(userId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: SocialPreferences) => api.saveSocialPreferences(body),
    onSuccess: async (data) => {
      client.setQueryData(['friends', userId], data);
      await client.invalidateQueries({ queryKey: ['friends-feed', userId] });
    },
  });
}
export function useStartClubCycle(userId: string, clubId: string) {
  const invalidate = useInvalidateCommunity(userId);
  return useMutation({
    mutationFn: (body: CreateCycleRequest) => api.startClubCycle(clubId, body),
    onSuccess: invalidate,
  });
}
export function useCloseClubCycle(userId: string, clubId: string) {
  const invalidate = useInvalidateCommunity(userId);
  return useMutation({
    mutationFn: (cycleId: string) => api.closeClubCycle(clubId, cycleId),
    onSuccess: invalidate,
  });
}

export function useModerationQueue(userId: string | undefined, reveal: boolean) {
  return useQuery({
    queryKey: ['moderation', userId, reveal],
    queryFn: ({ signal }) => api.getModerationQueue(reveal, signal),
    enabled: Boolean(userId),
    gcTime: 0,
    staleTime: 0,
  });
}
export function useGlobalModeration(userId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: GlobalModerationRequest) => api.moderateReportedContent(body),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['moderation', userId] }),
        client.invalidateQueries({ queryKey: ['clubs', userId] }),
      ]);
    },
  });
}

export function useClubTopic(
  userId: string | undefined,
  clubId: string,
  postId: string,
  reveal: boolean,
) {
  return useQuery({
    queryKey: queryKeys.clubTopic(userId ?? MISSING_USER, clubId, postId, reveal),
    queryFn: ({ signal }) => api.getClubTopic(clubId, postId, reveal, signal),
    enabled: Boolean(userId) && clubId !== '' && postId !== '',
  });
}

/** Everything under ['clubs', userId] plus the shelf (joining shelves the club's book). */
function useInvalidateCommunity(userId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['clubs', userId] }),
      queryClient.invalidateQueries({ queryKey: ['shelf', userId] }),
    ]);
}

export function useCreateClub(userId: string) {
  const invalidate = useInvalidateCommunity(userId);
  return useMutation({
    mutationFn: (body: CreateClubRequest) => api.createClub(body),
    onSuccess: invalidate,
  });
}

/** Joins a public club; the club id is given per call so lists can join any of their clubs. */
export function useJoinClub(userId: string) {
  const invalidate = useInvalidateCommunity(userId);
  return useMutation({
    mutationFn: (clubId: string) => api.joinClub(clubId),
    onSuccess: invalidate,
  });
}

export function useLeaveClub(userId: string, clubId: string) {
  const invalidate = useInvalidateCommunity(userId);
  return useMutation({ mutationFn: () => api.leaveClub(clubId), onSuccess: invalidate });
}

export function useDeleteClub(userId: string, clubId: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateCommunity(userId);
  return useMutation({
    mutationFn: () => api.deleteClub(clubId),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: queryKeys.club(userId, clubId) });
      await invalidate();
    },
  });
}

export function useCreateClubPost(userId: string, clubId: string) {
  const invalidate = useInvalidateCommunity(userId);
  return useMutation({
    mutationFn: (body: CreatePostRequest) => api.createClubPost(clubId, body),
    onSuccess: invalidate,
  });
}

export function useCreateClubReply(userId: string, clubId: string, postId: string) {
  const invalidate = useInvalidateCommunity(userId);
  return useMutation({
    mutationFn: (body: CreateReplyRequest) => api.createClubReply(clubId, postId, body),
    onSuccess: invalidate,
  });
}

export function useDeleteClubContent(userId: string, clubId: string) {
  const invalidate = useInvalidateCommunity(userId);
  return useMutation({
    mutationFn: ({ targetType, targetId }: { targetType: 'post' | 'reply'; targetId: string }) =>
      targetType === 'post'
        ? api.deleteClubPost(clubId, targetId)
        : api.deleteClubReply(clubId, targetId),
    onSuccess: invalidate,
  });
}

export function useModerateClubContent(userId: string, clubId: string) {
  const invalidate = useInvalidateCommunity(userId);
  return useMutation({
    mutationFn: (body: ModerationRequest) => api.moderateClubContent(clubId, body),
    onSuccess: invalidate,
  });
}

export function useReportContent(userId: string) {
  const invalidate = useInvalidateCommunity(userId);
  return useMutation({
    mutationFn: (body: ReportRequest) => api.reportContent(body),
    onSuccess: invalidate,
  });
}

export function useBlocks(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.blocks(userId ?? MISSING_USER),
    queryFn: ({ signal }) => api.listBlocks(signal),
    enabled: Boolean(userId),
  });
}

function useInvalidateBlocks(userId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.blocks(userId) }),
      queryClient.invalidateQueries({ queryKey: ['clubs', userId] }),
      queryClient.invalidateQueries({ queryKey: ['friends', userId] }),
      queryClient.removeQueries({ queryKey: ['friends-feed', userId] }),
    ]);
}

export function useBlockUser(userId: string) {
  const invalidate = useInvalidateBlocks(userId);
  return useMutation({
    mutationFn: (target: string) => api.blockUser(target),
    onSuccess: invalidate,
  });
}

export function useUnblockUser(userId: string) {
  const invalidate = useInvalidateBlocks(userId);
  return useMutation({
    mutationFn: (target: string) => api.unblockUser(target),
    onSuccess: invalidate,
  });
}

// ---------------------------------------------------------------------------------------------
// Comunidade part 2 (Task 08)
// ---------------------------------------------------------------------------------------------

export function useCommunityFeed(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.communityFeed(userId ?? MISSING_USER),
    queryFn: ({ signal }) => api.getCommunityFeed(signal),
    enabled: Boolean(userId) && enabled,
  });
}

export function useClubMembers(userId: string | undefined, clubId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.clubMembers(userId ?? MISSING_USER, clubId),
    queryFn: ({ signal }) => api.listClubMembers(clubId, signal),
    enabled: Boolean(userId) && clubId !== '' && enabled,
  });
}

export function useClubPolls(userId: string | undefined, clubId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.clubPolls(userId ?? MISSING_USER, clubId),
    queryFn: ({ signal }) => api.listClubPolls(clubId, signal),
    enabled: Boolean(userId) && clubId !== '' && enabled,
  });
}

/** Poll results change while it is open: refresh every 15 s while the screen is visible. */
export function useClubPoll(
  userId: string | undefined,
  clubId: string,
  pollId: string,
  reveal: boolean,
) {
  return useQuery({
    queryKey: queryKeys.clubPoll(userId ?? MISSING_USER, clubId, pollId, reveal),
    queryFn: ({ signal }) => api.getClubPoll(clubId, pollId, reveal, signal),
    enabled: Boolean(userId) && clubId !== '' && pollId !== '',
    refetchInterval: (query) => (query.state.data?.poll.isOpen ? 15_000 : false),
  });
}

export function useInvitePreview(userId: string | undefined, code: string) {
  return useQuery({
    queryKey: queryKeys.invite(userId ?? MISSING_USER, code),
    queryFn: ({ signal }) => api.getInvitePreview(code, signal),
    enabled: Boolean(userId) && code !== '',
    retry: false,
  });
}

export function useJoinByCode(userId: string) {
  const invalidate = useInvalidateCommunity(userId);
  return useMutation({ mutationFn: (code: string) => api.joinByCode(code), onSuccess: invalidate });
}

export function useRegenerateInviteCode(userId: string, clubId: string) {
  const invalidate = useInvalidateCommunity(userId);
  return useMutation({
    mutationFn: () => api.regenerateInviteCode(clubId),
    onSuccess: invalidate,
  });
}

export function useCreateClubPoll(userId: string, clubId: string) {
  const invalidate = useInvalidateCommunity(userId);
  return useMutation({
    mutationFn: (body: CreatePollRequest) => api.createClubPoll(clubId, body),
    onSuccess: invalidate,
  });
}

export function useDeleteClubPoll(userId: string, clubId: string) {
  const invalidate = useInvalidateCommunity(userId);
  return useMutation({
    mutationFn: (pollId: string) => api.deleteClubPoll(clubId, pollId),
    onSuccess: invalidate,
  });
}

/** Votes on any poll of a club (the poll id is given per call so lists can reuse one hook). */
export function useVotePoll(userId: string, clubId: string) {
  const invalidate = useInvalidateCommunity(userId);
  return useMutation({
    mutationFn: ({ pollId, optionIds }: { pollId: string; optionIds: string[] }) =>
      api.votePoll(clubId, pollId, optionIds),
    onSuccess: invalidate,
  });
}

export function useSavePollArgument(userId: string, clubId: string, pollId: string) {
  const invalidate = useInvalidateCommunity(userId);
  return useMutation({
    mutationFn: (body: string) => api.savePollArgument(clubId, pollId, body),
    onSuccess: invalidate,
  });
}

export function useDeletePollArgument(userId: string, clubId: string, pollId: string) {
  const invalidate = useInvalidateCommunity(userId);
  return useMutation({
    mutationFn: () => api.deletePollArgument(clubId, pollId),
    onSuccess: invalidate,
  });
}

export function useSetReaction(userId: string) {
  const invalidate = useInvalidateCommunity(userId);
  return useMutation({
    mutationFn: (body: ReactionRequest) => api.setReaction(body),
    onSuccess: invalidate,
  });
}
