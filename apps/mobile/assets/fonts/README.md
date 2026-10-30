# Fonts

**Nunito** (weights 400, 500, 600, 700, 800, 900), designed by Vernon Adams, Cyreal and Jacques
Le Bailly. Licensed under the SIL Open Font License 1.1 (https://openfontlicense.org). The TTF
files come unmodified from the `@expo-google-fonts/nunito@0.4.2` package, which redistributes the
Google Fonts release. Nunito is the app font since ADR-043.

**Caveat** (weight 500), by Impallari Type, and **IBM Plex Mono** (weights 400 and 700), by IBM
(Reserved Font Name "Plex"), both under the SIL Open Font License 1.1, unmodified from
`@expo-google-fonts/caveat@0.4.2` and `@expo-google-fonts/ibm-plex-mono@0.4.1`. They are accent
faces of the reading flow only (ADR-044): handwriting on the recall card and the reading receipt.

**Plus Jakarta Sans** (weights 400–800), designed by Tokotype, same license, unmodified from
`@expo-google-fonts/plus-jakarta-sans@0.4.2`. It is no longer used by the app screens; it stays
here because the native widgets (`plugins/with-bubo-widgets.config.cjs`) copy it from this folder.

App fonts are embedded at build time through the `expo-font` config plugin (see `app.config.ts`)
and also loaded at runtime with `useFonts` as a fallback for Expo Go. Font family names are the
file names without extension (for example `Nunito_700Bold`), exposed as tokens in
`src/theme/typography.ts`.
