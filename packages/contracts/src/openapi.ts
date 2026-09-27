import { z } from 'zod';

import { errorResponseSchema } from './errors';
import { API_ROUTE_DEFINITIONS, API_ROUTES, type ApiRouteDefinition } from './routes';

type JsonObject = { [key: string]: unknown };

export type OpenApiInfo = { title: string; version: string; serverUrl?: string; prefix: string };

function toSchema(schema: z.ZodType, io: 'input' | 'output' = 'output'): JsonObject {
  const json = z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    unrepresentable: 'any',
    io,
  }) as JsonObject;
  delete json.$schema;
  return json;
}

/**
 * Builds an OpenAPI 3.0 document from the Zod contracts (zod 4 native JSON Schema export),
 * so the documentation can never drift from the validated shapes.
 */
export function buildOpenApiDocument(
  info: OpenApiInfo,
  routes: ApiRouteDefinition[] = API_ROUTE_DEFINITIONS,
): JsonObject {
  const paths: Record<string, JsonObject> = {};
  for (const route of routes) {
    const responses: JsonObject = {};
    for (const [status, response] of Object.entries(route.responses)) {
      responses[status] = {
        description: response.description,
        content: { 'application/json': { schema: toSchema(response.schema) } },
      };
    }
    responses.default = {
      description: 'Error envelope.',
      content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
    };
    // Hono-style `:id` → OpenAPI `{id}` with a documented path parameter.
    const params = [...route.path.matchAll(/:(\w+)/g)].map((m) => m[1] ?? '');
    const path = `${info.prefix}${route.path.replace(/:(\w+)/g, '{$1}')}`;
    paths[path] = {
      ...paths[path],
      [route.method]: {
        summary: route.summary,
        tags: route.tags,
        ...(params.length
          ? {
              parameters: params.map((name) => ({
                name,
                in: 'path',
                required: true,
                schema: { type: 'string' },
              })),
            }
          : {}),
        ...(route.auth ? { security: [{ sessionCookie: [] }] } : {}),
        ...(route.requestBody
          ? {
              requestBody: {
                required: true,
                content: { 'application/json': { schema: toSchema(route.requestBody, 'input') } },
              },
            }
          : {}),
        responses,
      },
    };
  }

  return {
    openapi: '3.0.3',
    info: {
      title: info.title,
      version: info.version,
      description: `Authentication endpoints are served by Better Auth under ${info.prefix}${API_ROUTES.auth}/* (sign-up/email, sign-in/email, sign-out, get-session, request-password-reset, reset-password).`,
    },
    ...(info.serverUrl ? { servers: [{ url: info.serverUrl }] } : {}),
    paths,
    components: {
      schemas: { ErrorResponse: toSchema(errorResponseSchema) },
      securitySchemes: {
        sessionCookie: { type: 'apiKey', in: 'cookie', name: 'better-auth.session_token' },
      },
      headers: {
        'X-Request-Id': {
          description: 'Correlation id echoed on every response.',
          schema: { type: 'string' },
        },
      },
    },
  };
}
