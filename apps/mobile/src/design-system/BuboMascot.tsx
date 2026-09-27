import { Image } from 'expo-image';
import { MascotGreeting } from '../lib/motion';

import {
  buboMascots,
  mascotForState,
  mascotLabels,
  type MascotPose,
  type MascotState,
} from '../assets/registry';

type Props = {
  size?: number;
  animated?: boolean;
  /** Decorative mascots are hidden from screen readers (default: true next to explanatory text). */
  decorative?: boolean;
} & ({ pose: MascotPose; state?: never } | { state: MascotState; pose?: never });

/**
 * Renders an OFFICIAL Bubo mascot pose. Pick by semantic `state` whenever possible so the emotional
 * language stays consistent across the app.
 */
export function BuboMascot({
  size = 96,
  decorative = true,
  animated = false,
  ...selection
}: Props) {
  const pose: MascotPose = selection.pose ?? mascotForState[selection.state as MascotState];
  const image = (
    <Image
      source={buboMascots[pose]}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessible={!decorative}
      accessibilityLabel={decorative ? undefined : mascotLabels[pose]}
      transition={0}
    />
  );
  return animated ? <MascotGreeting key={pose}>{image}</MascotGreeting> : image;
}
