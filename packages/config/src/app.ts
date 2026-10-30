/** Product-wide constants shared by the mobile app and the API. */
export const APP_NAME = 'Bubo';
export const APP_TAGLINE = 'Read deeply.';
export const APP_SCHEME = 'bubo';
export const APP_BUNDLE_ID = 'com.joaoaraujo.bubo';

/** Every public API route lives under this prefix. */
export const API_PREFIX = '/v1';
export const API_SERVICE_NAME = 'bubo-api';

/**
 * Sent by the app on every auth request: it can finish a sign-in with the e-mailed login code
 * (ADR-038/040). Builds without it would wait forever on the code challenge, so the API answers
 * them with `APP_UPDATE_REQUIRED` instead.
 */
export const AUTH_CLIENT_HEADER = 'x-bubo-auth';
export const AUTH_CLIENT_LOGIN_CODE = 'login-code';

export const APP_ENVS = ['development', 'preview', 'production'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

/** Default Gemini model; override with GEMINI_MODEL. Gemini is only ever called server-side. */
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
