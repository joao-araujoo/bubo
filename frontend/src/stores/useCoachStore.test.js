import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../services/api';
import { useCoachStore } from './useCoachStore';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

const reset = () => useCoachStore.setState({
  status: null,
  profile: null,
  isLoadingStatus: false,
  isLoadingProfile: false,
  error: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  reset();
});

describe('useCoachStore', () => {
  it('loads provider status without exposing credentials', async () => {
    api.get.mockResolvedValue({
      data: {
        coach: {
          provider: 'gemini',
          model: 'gemini-2.0-flash',
          connected: true,
        },
      },
    });

    await useCoachStore.getState().fetchStatus();

    expect(api.get).toHaveBeenCalledWith('/deep-review/status');
    expect(useCoachStore.getState().status).toMatchObject({
      provider: 'gemini',
      connected: true,
    });
  });

  it('loads the cognitive profile and synchronizes coach status', async () => {
    const profile = {
      coach: { provider: 'local', connected: false },
      summary: { totalReviews: 3, averageDepth: 78 },
      dimensions: {},
      books: [],
    };
    api.get.mockResolvedValue({ data: profile });

    await useCoachStore.getState().fetchProfile();

    expect(api.get).toHaveBeenCalledWith('/deep-review/profile');
    expect(useCoachStore.getState()).toMatchObject({
      profile,
      status: profile.coach,
      isLoadingProfile: false,
    });
  });

  it('exposes a useful error when the profile cannot be loaded', async () => {
    api.get.mockRejectedValue({
      response: { data: { message: 'Perfil indisponível' } },
    });

    await expect(useCoachStore.getState().fetchProfile()).rejects.toThrow('Perfil indisponível');
    expect(useCoachStore.getState()).toMatchObject({
      error: 'Perfil indisponível',
      isLoadingProfile: false,
    });
  });
});
