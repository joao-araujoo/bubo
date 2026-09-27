import { type ConfigContext, type ExpoConfig } from 'expo/config';

/**
 * Bubo app config. Colours here are native-only (splash / adaptive icon) and mirror
 * src/theme/colors.ts. The New Architecture is the only architecture in SDK 57 (the old
 * `newArchEnabled` flag no longer exists), so it is always on.
 */
const FONTS = [
  './assets/fonts/PlusJakartaSans_400Regular.ttf',
  './assets/fonts/PlusJakartaSans_500Medium.ttf',
  './assets/fonts/PlusJakartaSans_600SemiBold.ttf',
  './assets/fonts/PlusJakartaSans_700Bold.ttf',
  './assets/fonts/PlusJakartaSans_800ExtraBold.ttf',
];

/**
 * Release builds must talk to the real API over HTTPS. Failing here stops an EAS build before a
 * misconfigured binary (pointing at localhost or plain HTTP) can ever reach a store.
 */
function assertReleaseApiUrl() {
  const profile = process.env.EAS_BUILD_PROFILE;
  if (profile !== 'production' && profile !== 'preview') return;
  const url = process.env.EXPO_PUBLIC_API_URL ?? '';
  if (!url.startsWith('https://')) {
    throw new Error(
      `EXPO_PUBLIC_API_URL must be an https:// URL for "${profile}" builds (got "${url || 'empty'}"). ` +
        'Set it in the EAS environment (eas env:create) — see docs/release.md.',
    );
  }
}

export default ({ config }: ConfigContext): ExpoConfig => {
  assertReleaseApiUrl();
  return {
    ...config,
    name: 'Bubo',
    slug: 'bubo',
    scheme: 'bubo',
    version: '0.3.0',
    orientation: 'portrait',
    // Native-only product: no react-native-web / react-dom in the dependency tree.
    platforms: ['ios', 'android'],
    // Light is the product default (the Stitch designs are light-first); dark stays opt-in in-app.
    userInterfaceStyle: 'light',
    icon: './assets/icons/app-icon.png',
    ios: {
      bundleIdentifier: 'com.joaoaraujo.bubo',
      supportsTablet: false,
      icon: './assets/icons/app-icon.png',
      infoPlist: {
        // Only standard HTTPS/TLS is used (exempt), so App Store Connect doesn't ask every build.
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: 'com.joaoaraujo.bubo',
      adaptiveIcon: {
        foregroundImage: './assets/icons/adaptive-icon-foreground.png',
        backgroundColor: '#FFFFFF',
      },
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/icons/splash-icon.png',
          imageWidth: 160,
          resizeMode: 'contain',
          backgroundColor: '#F8F5FF',
        },
      ],
      ['expo-font', { fonts: FONTS }],
      [
        'expo-camera',
        {
          cameraPermission:
            'O Bubo usa a câmera só para ler o código de barras (ISBN) do livro que você quer adicionar.',
          microphonePermission: false,
          recordAudioAndroid: false,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
  };
};
