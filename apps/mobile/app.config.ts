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
 * Release builds must talk to the real API over HTTPS. Failing here stops local and EAS builds before a
 * misconfigured binary (pointing at localhost or plain HTTP) can ever reach a store.
 */
function assertReleaseApiUrl() {
  const profile = process.env.BUBO_BUILD_PROFILE ?? process.env.EAS_BUILD_PROFILE;
  if (profile !== 'production' && profile !== 'preview') return;
  const url = process.env.EXPO_PUBLIC_API_URL ?? '';
  let valid: boolean;
  try {
    const parsed = new URL(url);
    valid =
      parsed.protocol === 'https:' &&
      !parsed.username &&
      !parsed.password &&
      !parsed.search &&
      !parsed.hash &&
      !['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(parsed.hostname);
  } catch {
    valid = false;
  }
  if (!valid) {
    throw new Error(
      `EXPO_PUBLIC_API_URL must be a public HTTPS URL without credentials for "${profile}" builds. ` +
        'See docs/build-mobile.md or docs/release.md.',
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
      // Android push (FCM) needs the owner's Firebase file, given to EAS as a file environment
      // variable. Without it the app runs and says push is unavailable on that build.
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON,
      adaptiveIcon: {
        foregroundImage: './assets/icons/adaptive-icon-foreground.png',
        backgroundColor: '#FFFFFF',
      },
    },
    plugins: [
      './plugins/with-bubo-widgets.config.cjs',
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
        'expo-notifications',
        {
          // Android draws only the alpha shape of the official transparent foreground (no new
          // artwork, no recolouring); see docs/brand-assets.md.
          icon: './assets/icons/adaptive-icon-foreground.png',
          color: '#7C3AED',
          defaultChannel: 'lembretes',
        },
      ],
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
