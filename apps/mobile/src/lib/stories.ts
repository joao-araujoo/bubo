import { requireOptionalNativeModule } from 'expo-modules-core';

import { createStorySharing, type StoryNative } from './story-sharing';

const sharing = createStorySharing(
  requireOptionalNativeModule<StoryNative>('BuboStories'),
  process.env.EXPO_PUBLIC_INSTAGRAM_APP_ID,
);

export const { getStorySharingAvailability, shareInstagramStory, shareStoryImage, saveStoryImage } =
  sharing;

export type { StoryShareResult } from './story-sharing';
