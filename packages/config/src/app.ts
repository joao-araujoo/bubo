/** Product-wide constants shared by the mobile app and the API. */
export const APP_NAME = 'Bubo';
export const APP_TAGLINE = 'Read deeply.';
export const APP_SCHEME = 'bubo';
export const APP_BUNDLE_ID = 'com.joaoaraujo.bubo';

/** Every public API route lives under this prefix. */
export const API_PREFIX = '/v1';
export const API_SERVICE_NAME = 'bubo-api';

export const APP_ENVS = ['development', 'preview', 'production'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

/** Default Gemini model; override with GEMINI_MODEL. Gemini is only ever called server-side. */
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
