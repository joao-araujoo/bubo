import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { buboMascots, type BuboMascotState } from '../../assets/bubo';

type Props = {
  state?: BuboMascotState;
  size?: number;
};

export function BuboMascot({ state = 'neutral', size = 104 }: Props) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Image
        source={buboMascots[state]}
        style={{ width: size, height: size }}
        contentFit="contain"
        transition={120}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
