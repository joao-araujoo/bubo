import { create } from 'zustand';
import api from '../services/api';

const patchActivity = (activities, activityId, patch) => activities.map((activity) => (
  String(activity._id) === String(activityId)
    ? { ...activity, ...patch }
    : activity
));

const patchAuthor = (activities, userId, patch) => activities.map((activity) => (
  String(activity.userId) === String(userId)
    ? { ...activity, ...patch }
    : activity
));

const getMessage = (error, fallback) => error.response?.data?.message || fallback;

export const useSocialStore = create((set, get) => ({
  activities: [],
  commentsByActivity: {},
  loadingComments: {},
  notifications: [],
  unreadNotifications: 0,
  scope: 'all',
  isLoading: false,
  isPublishing: false,
  isLoadingNotifications: false,
  error: null,

  fetchFeed: async (scope = get().scope) => {
    set({ isLoading: true, error: null, scope });
    try {
      const { data } = await api.get(`/social/feed?scope=${encodeURIComponent(scope)}`);
      set({ activities: data.activities || [], isLoading: false, scope: data.scope || scope });
      return data.activities || [];
    } catch (error) {
      const message = getMessage(error, 'Não foi possível carregar o feed.');
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  createPost: async ({ message, insight = '', postType = 'free', bookId }) => {
    set({ isPublishing: true, error: null });
    try {
      const { data } = await api.post('/social/activity', {
        type: 'post',
        postType,
        message,
        insight,
        bookId
      });
      set((state) => ({
        activities: [data.activity, ...state.activities],
        isPublishing: false
      }));
      return data.activity;
    } catch (error) {
      const message = getMessage(error, 'Não foi possível publicar agora.');
      set({ error: message, isPublishing: false });
      throw new Error(message);
    }
  },

  toggleLike: async (activityId) => {
    const before = get().activities;
    const activity = before.find((item) => String(item._id) === String(activityId));
    if (!activity) return null;

    const optimisticLiked = !activity.isLiked;
    const optimisticCount = Math.max(0, Number(activity.likesCount || 0) + (optimisticLiked ? 1 : -1));
    set({ activities: patchActivity(before, activityId, { isLiked: optimisticLiked, likesCount: optimisticCount }) });

    try {
      const { data } = await api.put(`/social/activity/${activityId}/like`);
      set((state) => ({
        activities: patchActivity(state.activities, activityId, {
          isLiked: data.active,
          likesCount: data.count
        })
      }));
      return data;
    } catch (error) {
      set({ activities: before });
      throw new Error(getMessage(error, 'Não foi possível atualizar a curtida.'));
    }
  },

  toggleSave: async (activityId) => {
    const before = get().activities;
    const activity = before.find((item) => String(item._id) === String(activityId));
    if (!activity) return null;

    set({ activities: patchActivity(before, activityId, { isSaved: !activity.isSaved }) });

    try {
      const { data } = await api.put(`/social/activity/${activityId}/save`);
      set((state) => ({
        activities: patchActivity(state.activities, activityId, { isSaved: data.active })
      }));
      return data;
    } catch (error) {
      set({ activities: before });
      throw new Error(getMessage(error, 'Não foi possível salvar a publicação.'));
    }
  },

  toggleFollow: async (userId) => {
    const before = get().activities;
    const authorActivity = before.find((item) => String(item.userId) === String(userId));
    if (!authorActivity) return null;

    set({ activities: patchAuthor(before, userId, { isFollowing: !authorActivity.isFollowing }) });

    try {
      const { data } = await api.put(`/social/users/${userId}/follow`);
      set((state) => ({
        activities: patchAuthor(state.activities, userId, { isFollowing: data.isFollowing })
      }));
      return data;
    } catch (error) {
      set({ activities: before });
      throw new Error(getMessage(error, 'Não foi possível atualizar este vínculo.'));
    }
  },

  fetchComments: async (activityId) => {
    set((state) => ({
      loadingComments: { ...state.loadingComments, [activityId]: true }
    }));

    try {
      const { data } = await api.get(`/social/activity/${activityId}/comments`);
      set((state) => ({
        commentsByActivity: {
          ...state.commentsByActivity,
          [activityId]: data.comments || []
        },
        loadingComments: { ...state.loadingComments, [activityId]: false }
      }));
      return data.comments || [];
    } catch (error) {
      set((state) => ({
        loadingComments: { ...state.loadingComments, [activityId]: false }
      }));
      throw new Error(getMessage(error, 'Não foi possível carregar os comentários.'));
    }
  },

  createComment: async (activityId, body) => {
    try {
      const { data } = await api.post(`/social/activity/${activityId}/comments`, { body });
      set((state) => ({
        commentsByActivity: {
          ...state.commentsByActivity,
          [activityId]: [...(state.commentsByActivity[activityId] || []), data.comment]
        },
        activities: patchActivity(state.activities, activityId, {
          commentsCount: Number(
            state.activities.find((item) => String(item._id) === String(activityId))?.commentsCount || 0
          ) + 1
        })
      }));
      return data.comment;
    } catch (error) {
      throw new Error(getMessage(error, 'Não foi possível publicar o comentário.'));
    }
  },

  deleteComment: async (activityId, commentId) => {
    const beforeComments = get().commentsByActivity[activityId] || [];
    const beforeActivities = get().activities;

    set((state) => ({
      commentsByActivity: {
        ...state.commentsByActivity,
        [activityId]: beforeComments.filter((comment) => String(comment._id) !== String(commentId))
      },
      activities: patchActivity(state.activities, activityId, {
        commentsCount: Math.max(0, Number(
          state.activities.find((item) => String(item._id) === String(activityId))?.commentsCount || 0
        ) - 1)
      })
    }));

    try {
      await api.delete(`/social/comments/${commentId}`);
    } catch (error) {
      set((state) => ({
        commentsByActivity: {
          ...state.commentsByActivity,
          [activityId]: beforeComments
        },
        activities: beforeActivities
      }));
      throw new Error(getMessage(error, 'Não foi possível remover o comentário.'));
    }
  },

  fetchNotifications: async () => {
    set({ isLoadingNotifications: true });
    try {
      const { data } = await api.get('/social/notifications');
      set({
        notifications: data.notifications || [],
        unreadNotifications: data.unreadCount || 0,
        isLoadingNotifications: false
      });
      return data.notifications || [];
    } catch (error) {
      set({ isLoadingNotifications: false });
      throw new Error(getMessage(error, 'Não foi possível carregar as notificações.'));
    }
  },

  markNotificationsRead: async (ids = []) => {
    const { data } = await api.post('/social/notifications/read', { ids });
    const idSet = new Set(ids.map(String));
    set((state) => ({
      unreadNotifications: data.unreadCount || 0,
      notifications: state.notifications.map((notification) => (
        ids.length === 0 || idSet.has(String(notification._id))
          ? { ...notification, isRead: true }
          : notification
      ))
    }));
    return data;
  },

  resetSocial: () => set({
    activities: [],
    commentsByActivity: {},
    loadingComments: {},
    notifications: [],
    unreadNotifications: 0,
    scope: 'all',
    isLoading: false,
    isPublishing: false,
    isLoadingNotifications: false,
    error: null
  })
}));
