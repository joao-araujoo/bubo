# Fonts

Plus Jakarta Sans (weights 400, 500, 600, 700, 800), designed by Tokotype. Licensed under the
SIL Open Font License 1.1 (https://openfontlicense.org). The TTF files come unmodified from the
`@expo-google-fonts/plus-jakarta-sans@0.4.2` package, which redistributes the Google Fonts release.

Files are embedded at build time through the `expo-font` config plugin (see `app.config.ts`) and
also loaded at runtime with `useFonts` as a fallback for Expo Go. Font family names are the file
names without extension (for example `PlusJakartaSans_700Bold`), exposed as tokens in
`src/theme/typography.ts`.
