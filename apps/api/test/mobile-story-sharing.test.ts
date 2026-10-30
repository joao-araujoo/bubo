import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

import {
  createStorySharing,
  localStoryUri,
  type StoryNative,
} from '../../mobile/src/lib/story-sharing';

const require = createRequire(import.meta.url);
const plugin = require('../../mobile/plugins/with-bubo-stories.config.cjs') as {
  configureInfoPlist: (plist: Record<string, unknown>) => Record<string, unknown>;
};

function native(): StoryNative {
  return {
    shareInstagram: vi.fn().mockResolvedValue({ status: 'opened' }),
    shareImage: vi.fn().mockResolvedValue({ status: 'opened' }),
    saveImage: vi.fn().mockResolvedValue({ status: 'saved' }),
  };
}

describe('local Story handoff', () => {
  it('only accepts local file URIs before calling the native path and image checks', () => {
    expect(localStoryUri('/cache/a book.png')).toBe('file:///cache/a%20book.png');
    expect(localStoryUri('file:///cache/image.png')).toBe('file:///cache/image.png');
    for (const input of [
      'https://example.com/book.png',
      'content://provider/private.png',
      'data:image/png;base64,anything',
      'file://another-host/book.png',
      'file:///cache/image.png?token=private',
      'file:///cache/image.png#image',
      'relative/image.png',
      'file:///',
    ]) {
      expect(localStoryUri(input)).toBeNull();
    }
  });

  it('keeps Expo Go unavailable and never replaces missing Meta setup with a made-up ID', async () => {
    const unavailable = createStorySharing(null);
    expect(unavailable.getStorySharingAvailability()).toEqual({
      native: false,
      instagramConfigured: false,
    });
    await expect(unavailable.shareStoryImage('/cache/story.png')).resolves.toEqual({
      status: 'unavailable',
      reason: 'native-module',
    });
    const module = native();
    const sharing = createStorySharing(module);
    for (const id of [undefined, '', 'your_fb_app_id', '123&other=value', ' 12345678 ']) {
      await expect(sharing.shareInstagramStory('/cache/story.png', id)).resolves.toEqual({
        status: 'unavailable',
        reason: 'app-id',
      });
    }
    expect(module.shareInstagram).not.toHaveBeenCalled();
    await expect(sharing.shareStoryImage('/cache/story.png')).resolves.toEqual({
      status: 'opened',
    });
    await expect(sharing.saveStoryImage('/cache/story.png')).resolves.toEqual({ status: 'saved' });
  });

  it('passes the real configured app ID and PNG URI without claiming publication', async () => {
    const module = native();
    const sharing = createStorySharing(module, '12345678');
    await expect(sharing.shareInstagramStory('/cache/story.png')).resolves.toEqual({
      status: 'opened',
    });
    expect(module.shareInstagram).toHaveBeenCalledWith('file:///cache/story.png', '12345678');
    await expect(sharing.shareStoryImage('https://example.com/image.png')).resolves.toEqual({
      status: 'error',
      reason: 'image',
    });
    expect(module.shareImage).not.toHaveBeenCalled();
  });

  it('serializes handoffs and recovers from rejection so the user can retry or save', async () => {
    let finish: (result: { status: 'cancelled' }) => void = () => undefined;
    const module = native();
    module.shareImage = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    const sharing = createStorySharing(module);
    const opening = sharing.shareStoryImage('/cache/story.png');
    await expect(sharing.saveStoryImage('/cache/story.png')).resolves.toEqual({
      status: 'unavailable',
      reason: 'busy',
    });
    finish({ status: 'cancelled' });
    await expect(opening).resolves.toEqual({ status: 'cancelled' });
    module.shareImage = vi.fn().mockRejectedValue(new Error('platform'));
    await expect(sharing.shareStoryImage('/cache/story.png')).resolves.toEqual({
      status: 'error',
      reason: 'share',
    });
    await expect(sharing.saveStoryImage('/cache/story.png')).resolves.toEqual({ status: 'saved' });
  });

  it('adds only photo-library addition permission and preserves other URL schemes on iOS', () => {
    const plist = { LSApplicationQueriesSchemes: ['bubo', 'instagram-stories'] };
    const configured = plugin.configureInfoPlist(plist);
    expect(configured.LSApplicationQueriesSchemes).toEqual(['bubo', 'instagram-stories']);
    expect(configured.NSPhotoLibraryAddUsageDescription).toContain('salvar');
    expect(configured).not.toHaveProperty('NSPhotoLibraryUsageDescription');
    expect(plugin.configureInfoPlist(configured)).toEqual(configured);
  });
});
