export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Bubo API',
    version: '4.0.0-alpha.0',
    description: 'API oficial do Bubo 4.',
  },
  servers: [{ url: '/' }],
  paths: {
    '/health': {
      get: {
        summary: 'Liveness do Worker',
        responses: { '200': { description: 'Worker ativo' } },
      },
    },
    '/ready': {
      get: {
        summary: 'Readiness da API',
        responses: {
          '200': { description: 'Dependências prontas' },
          '503': { description: 'Configuração ou banco indisponível' },
        },
      },
    },
    '/api/auth/{path}': {
      get: {
        summary: 'Better Auth',
        parameters: [
          {
            name: 'path',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: { default: { description: 'Resposta Better Auth' } },
      },
      post: {
        summary: 'Better Auth',
        parameters: [
          {
            name: 'path',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: { default: { description: 'Resposta Better Auth' } },
      },
    },
    '/v1/me': {
      get: {
        summary: 'Sessão e perfil do usuário atual',
        responses: {
          '200': { description: 'Perfil atual' },
          '401': { description: 'Sem sessão' },
        },
      },
    },
    '/v1/onboarding/complete': {
      put: {
        summary: 'Concluir onboarding',
        description:
          'Persiste as preferências do usuário autenticado. O user_id nunca é aceito do cliente.',
        responses: {
          '200': { description: 'Onboarding concluído' },
          '400': { description: 'Payload inválido' },
          '401': { description: 'Sem sessão' },
        },
      },
    },
  },
} as const;
