import { Image } from 'expo-image';

import { buboBrand } from '../assets/registry';

type Props = { height?: number; variant?: 'horizontal' | 'symbol' };

/** Official Bubo logo (horizontal lockup) or symbol. Never recoloured or redrawn. */
export function BuboLogo({ height = 28, variant = 'horizontal' }: Props) {
  const asset = variant === 'horizontal' ? buboBrand.logoHorizontal : buboBrand.symbol;
  return (
    <Image
      source={asset.source}
      style={{ height, width: height * asset.aspectRatio }}
      contentFit="contain"
      accessible
      accessibilityRole="image"
      accessibilityLabel={asset.accessibilityLabel}
      transition={0}
    />
  );
}
