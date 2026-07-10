import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../services/api';
import { useSocialStore } from './useSocialStore';

vi.mock('../services/api', () => ({
  default: {
    delete: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

const activity = {
  _id: 'activity-1',
  userId: 'reader-2',
  isLiked: false,
  isSaved: false,
  isFollowing: false,
  likesCount: 2,
  commentsCount: 0,
};

const reset = () => useSocialStore.setState({
  activities: [activity],
  commentsByActivity: {},
  loadingComments: {},
  notifications: [],
  unreadNotifications: 0,
  scope: 'all',
  isLoading: false,
  isPublishing: false,
  isLoadingNotifications: false,
  error: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  reset();
});

describe('useSocialStore', () => {
  it('updates a like optimistically and reconciles with the server', async () => {
    let resolveRequest;
    api.put.mockReturnValue(new Promise((resolve) => {
      resolveRequest = resolve;
    }));

    const pending = useSocialStore.getState().toggleLike('activity-1');

    expect(useSocialStore.getState().activities[0]).toMatchObject({
      isLiked: true,
      likesCount: 3,
    });

    resolveRequest({ data: { active: true, count: 4 } });
    await pending;

    expect(useSocialStore.getState().activities[0]).toMatchObject({
      isLiked: true,
      likesCount: 4,
    });
  });

  it('rolls back an optimistic like when the request fails', async () => {
    api.put.mockRejectedValue({ response: { data: { message: 'Falha de rede' } } });

    await expect(
      useSocialStore.getState().toggleLike('activity-1'),
    ).rejects.toThrow('Falha de rede');

    expect(useSocialStore.getState().activities[0]).toMatchObject({
      isLiked: false,
      likesCount: 2,
    });
  });

  it('updates every visible post from the same author when following', async () => {
    useSocialStore.setState({
      activities: [
        activity,
        { ...activity, _id: 'activity-2' },
      ],
    });
    api.put.mockResolvedValue({ data: { isFollowing: true, userId: 'reader-2' } });

    await useSocialStore.getState().toggleFollow('reader-2');

    expect(useSocialStore.getState().activities.every((item) => item.isFollowing)).toBe(true);
  });

  it('adds a persisted comment and increments the activity counter', async () => {
    const comment = {
      _id: 'comment-1',
      activityId: 'activity-1',
      body: 'Boa conexão.',
      username: 'João',
      isOwn: true,
    };
    api.post.mockResolvedValue({ data: { comment } });

    await useSocialStore.getState().createComment('activity-1', comment.body);

    expect(useSocialStore.getState().commentsByActivity['activity-1']).toEqual([comment]);
    expect(useSocialStore.getState().activities[0].commentsCount).toBe(1);
  });

  it('stores notifications and their unread total', async () => {
    api.get.mockResolvedValue({
      data: {
        unreadCount: 2,
        notifications: [{ _id: 'notification-1', isRead: false }],
      },
    });

    await useSocialStore.getState().fetchNotifications();

    expect(useSocialStore.getState()).toMatchObject({
      unreadNotifications: 2,
      notifications: [{ _id: 'notification-1', isRead: false }],
    });
  });
});
