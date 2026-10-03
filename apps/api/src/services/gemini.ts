import { z } from 'zod';

import { AppError } from '../lib/errors';

/**
 * Server-side Gemini client (REST `generateContent`). The API key only ever lives in Worker
 * secrets — the mobile app talks to Bubo's API, never to Gemini. No OpenAI anywhere.
 */
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

const generateContentResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({ parts: z.array(z.object({ text: z.string().optional() })).optional() })
          .optional(),
        finishReason: z.string().optional(),
      }),
    )
    .optional(),
  usageMetadata: z
    .object({
      promptTokenCount: z.number().optional(),
      candidatesTokenCount: z.number().optional(),
      totalTokenCount: z.number().optional(),
    })
    .optional(),
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
});

export type GeminiGenerateOptions = {
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Ask Gemini for JSON output (pair with a Zod parse of the text). */
  json?: boolean;
  /** Gemini 2.5 Flash can disable internal thinking for a short bounded coaching question. */
  thinkingBudget?: number;
};

export type GeminiResult = {
  text: string;
  model: string;
  finishReason: string | undefined;
  usage: { promptTokens: number; outputTokens: number; totalTokens: number };
};

export type GeminiServiceOptions = {
  apiKey: string | undefined;
  model: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

export class GeminiService {
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: GeminiServiceOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? 20_000;
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  get modelName(): string {
    return this.model;
  }

  async generateText(prompt: string, options: GeminiGenerateOptions = {}): Promise<GeminiResult> {
    if (!this.apiKey) {
      throw new AppError('SERVICE_UNAVAILABLE', 'AI features are not configured.');
    }
    if (prompt.trim().length === 0) {
      throw new AppError('VALIDATION_FAILED', 'Prompt must not be empty.');
    }

    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      ...(options.systemInstruction
        ? { systemInstruction: { parts: [{ text: options.systemInstruction }] } }
        : {}),
      generationConfig: {
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
        ...(options.maxOutputTokens !== undefined
          ? { maxOutputTokens: options.maxOutputTokens }
          : {}),
        ...(options.json ? { responseMimeType: 'application/json' } : {}),
        ...(options.thinkingBudget !== undefined
          ? { thinkingConfig: { thinkingBudget: options.thinkingBudget } }
          : {}),
      },
    };

    let response: Response;
    try {
      response = await this.fetchImpl(
        `${GEMINI_BASE_URL}/models/${encodeURIComponent(this.model)}:generateContent`,
        {
          method: 'POST',
          // Key in a header (not the query string) so it never appears in URLs or access logs.
          headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.timeoutMs),
        },
      );
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      throw new AppError(
        'UPSTREAM_ERROR',
        timedOut ? 'AI provider timed out.' : 'AI provider unreachable.',
        {
          cause: error,
        },
      );
    }

    if (response.status === 429) {
      throw new AppError('RATE_LIMITED', 'AI provider rate limit reached. Try again shortly.');
    }
    if (!response.ok) {
      throw new AppError('UPSTREAM_ERROR', `AI provider error (HTTP ${response.status}).`);
    }

    const parsed = generateContentResponseSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) {
      throw new AppError('UPSTREAM_ERROR', 'AI provider returned an unexpected response.');
    }
    const data = parsed.data;
    if (data.promptFeedback?.blockReason) {
      throw new AppError('UPSTREAM_ERROR', 'AI provider blocked the request.');
    }
    const candidate = data.candidates?.[0];
    const text = (candidate?.content?.parts ?? []).map((part) => part.text ?? '').join('');
    if (!text) {
      throw new AppError('UPSTREAM_ERROR', 'AI provider returned an empty response.');
    }

    return {
      text,
      model: this.model,
      finishReason: candidate?.finishReason,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: data.usageMetadata?.totalTokenCount ?? 0,
      },
    };
  }
}
