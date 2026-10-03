import { Image } from 'expo-image';
import { requireOptionalNativeModule } from 'expo-modules-core';

import { type WidgetKind } from '@bubo/contracts';

import { createWidgetPublisher, type WidgetNative } from './publisher';

const native = requireOptionalNativeModule<WidgetNative>('BuboWidgets');
export const widgetsAvailable = native !== null;
export const widgetPublisher = native
  ? createWidgetPublisher(
      native,
      async (url) => {
        await Image.prefetch(url, 'disk');
        return Image.getCachePathAsync(url);
      },
      false,
    )
  : null;

export async function clearWidgets() {
  await widgetPublisher?.clear();
}

export type { WidgetKind } from '@bubo/contracts';

export async function requestWidgetPin(kind: WidgetKind) {
  return native?.requestPin(kind) ?? false;
}
