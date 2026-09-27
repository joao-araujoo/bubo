import { describe, expect, it } from 'vitest';

import {
  API_ROUTE_DEFINITIONS,
  ERROR_CODES,
  ERROR_STATUS,
  buildOpenApiDocument,
  errorResponseSchema,
  healthResponseSchema,
  readyResponseSchema,
} from '../src';

describe('error model', () => {
  it('maps every error code to an HTTP error status', () => {
    for (const code of ERROR_CODES) {
      expect(ERROR_STATUS[code]).toBeGreaterThanOrEqual(400);
    }
  });

  it('accepts the canonical envelope and rejects unknown codes', () => {
    const valid = { error: { code: 'NOT_FOUND', message: 'Not found', requestId: 'req_1' } };
    expect(errorResponseSchema.safeParse(valid).success).toBe(true);
    const invalid = { error: { ...valid.error, code: 'TEAPOT' } };
    expect(errorResponseSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('system contracts', () => {
  it('validates a health payload', () => {
    const payload = {
      status: 'ok',
      service: 'bubo-api',
      version: '0.1.0',
      environment: 'development',
      timestamp: new Date().toISOString(),
    };
    expect(healthResponseSchema.parse(payload)).toEqual(payload);
  });

  it('validates a not-ready payload', () => {
    const payload = {
      status: 'not_ready',
      checks: {
        config: { status: 'ok' },
        database: { status: 'not_configured', message: 'DATABASE_URL is not set' },
      },
      timestamp: new Date().toISOString(),
    };
    expect(readyResponseSchema.safeParse(payload).success).toBe(true);
  });
});

describe('buildOpenApiDocument', () => {
  const doc = buildOpenApiDocument({ title: 'Bubo API', version: '0.1.0', prefix: '/v1' });

  it('documents every registered route under the prefix', () => {
    const paths = doc.paths as Record<string, Record<string, unknown>>;
    for (const route of API_ROUTE_DEFINITIONS) {
      const path = `/v1${route.path.replace(/:(\w+)/g, '{$1}')}`;
      expect(paths[path]?.[route.method], `${route.method} ${path}`).toBeDefined();
    }
    expect(paths['/v1/shelf/{id}']?.patch).toMatchObject({
      parameters: [{ name: 'id', in: 'path', required: true }],
    });
  });

  it('declares OpenAPI 3.0 and the shared error schema', () => {
    expect(doc.openapi).toBe('3.0.3');
    expect(JSON.stringify(doc)).toContain('#/components/schemas/ErrorResponse');
    expect(JSON.stringify(doc)).not.toContain('$schema');
  });
});
