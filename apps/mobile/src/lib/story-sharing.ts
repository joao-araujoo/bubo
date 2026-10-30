export type StoryShareResult = {
  /** `opened` is a handoff to an editor/share sheet, never a publication receipt. */
  status: 'opened' | 'saved' | 'cancelled' | 'unavailable' | 'error';
  reason?:
    | 'native-module'
    | 'app-id'
    | 'instagram'
    | 'permission'
    | 'android-version'
    | 'image'
    | 'busy'
    | 'share';
};

export type StoryNative = {
  shareInstagram: (uri: string, appId: string) => Promise<StoryShareResult>;
  shareImage: (uri: string) => Promise<StoryShareResult>;
  saveImage: (uri: string) => Promise<StoryShareResult>;
};

/** Normalize view-shot's local URI, leaving physical cache/dimension checks to the native module. */
export function localStoryUri(input: string): string | null {
  try {
    const uri = new URL(input.startsWith('/') ? `file://${input}` : input);
    if (
      uri.protocol !== 'file:' ||
      uri.hostname ||
      uri.username ||
      uri.password ||
      uri.search ||
      uri.hash ||
      !uri.pathname.startsWith('/') ||
      uri.pathname === '/'
    ) {
      return null;
    }
    return uri.href;
  } catch {
    return null;
  }
}

export function validInstagramAppId(appId: string | undefined): appId is string {
  return typeof appId === 'string' && /^[0-9]{5,30}$/.test(appId);
}

export function createStorySharing(native: StoryNative | null, configuredAppId?: string) {
  let pending = false;

  async function run(
    input: string,
    action: (module: StoryNative, uri: string) => Promise<StoryShareResult>,
  ): Promise<StoryShareResult> {
    if (!native) return { status: 'unavailable', reason: 'native-module' };
    const uri = localStoryUri(input);
    if (!uri) return { status: 'error', reason: 'image' };
    if (pending) return { status: 'unavailable', reason: 'busy' };
    pending = true;
    try {
      return await action(native, uri);
    } catch {
      return { status: 'error', reason: 'share' };
    } finally {
      pending = false;
    }
  }

  return {
    getStorySharingAvailability: () => ({
      native: native !== null,
      instagramConfigured: validInstagramAppId(configuredAppId),
    }),
    shareInstagramStory: async (
      uri: string,
      appId: string | undefined = configuredAppId,
    ): Promise<StoryShareResult> => {
      if (!native) return { status: 'unavailable', reason: 'native-module' };
      if (!validInstagramAppId(appId)) return { status: 'unavailable', reason: 'app-id' };
      return run(uri, (module, input) => module.shareInstagram(input, appId));
    },
    shareStoryImage: (uri: string) => run(uri, (module, input) => module.shareImage(input)),
    saveStoryImage: (uri: string) => run(uri, (module, input) => module.saveImage(input)),
  };
}
