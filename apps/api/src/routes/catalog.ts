import { API_ROUTES, catalogIdSchema, catalogSearchQuerySchema } from '@bubo/contracts';
import { toIsbn13 } from '@bubo/domain';
import { type Context, Hono } from 'hono';

import { type AppEnv } from '../env';
import { AppError } from '../lib/errors';
import { createRateLimiter } from '../lib/rate-limit';
import { type CatalogCache } from '../services/catalog-cache';
import { CatalogService, type FetchLike } from '../services/catalog';
import { CoverCache } from '../services/cover-cache';
import { MediaStorage } from '../services/media';
import { findCatalogEntryId } from '../services/shelf';

export type CatalogProvider = (c: Context<AppEnv>) => CatalogService;

/** Builds the request's catalog service (shared isolate cache, per-request logger and key). */
export function createCatalogProvider(deps: {
  fetch: FetchLike;
  cache: CatalogCache;
}): CatalogProvider {
  return (c) => {
    const config = c.get('config');
    return new CatalogService({
      fetch: deps.fetch,
      cache: deps.cache,
      googleApiKey: config.ok ? config.env.GOOGLE_BOOKS_API_KEY : undefined,
      logger: c.get('logger'),
      contact: config.ok ? config.env.CATALOG_CONTACT_EMAIL : undefined,
      covers:
        config.ok && config.env.MEDIA_PUBLIC_URL && c.env.MEDIA
          ? new CoverCache({
              fetch: deps.fetch,
              cache: deps.cache,
              media: new MediaStorage(c.env.MEDIA),
              publicUrl: config.env.MEDIA_PUBLIC_URL,
            })
          : undefined,
    });
  };
}

/** Catalog search, details and ISBN lookup (session-protected: they spend shared quotas). */
export function catalogRoutes(deps: { catalog: CatalogProvider; now: () => Date }) {
  const routes = new Hono<AppEnv>();
  const limiter = createRateLimiter({
    limit: 60,
    windowMs: 60_000,
    now: () => deps.now().getTime(),
  });

  routes.use('/catalog/*', async (c, next) => {
    limiter.hit(c.get('session').user.id);
    await next();
  });

  routes.get(API_ROUTES.catalogSearch, async (c) => {
    const query = catalogSearchQuerySchema.safeParse({
      q: c.req.query('q') ?? '',
      limit: c.req.query('limit') ?? undefined,
    });
    if (!query.success) {
      throw new AppError('VALIDATION_FAILED', 'Invalid search.', {
        issues: query.error.issues.map((issue) => ({
          path: issue.path.map(String).join('.') || '(root)',
          message: issue.message,
        })),
      });
    }
    const result = await deps.catalog(c).search(query.data.q, query.data.limit);
    c.header('Cache-Control', 'private, max-age=300');
    return c.json(result);
  });

  routes.get(API_ROUTES.catalogBook, async (c) => {
    const id = catalogIdSchema.safeParse(c.req.param('catalogId'));
    if (!id.success) throw new AppError('NOT_FOUND', 'Book not found in the catalog.');
    const catalog = deps.catalog(c);
    const found = await catalog.getBook(id.data);
    const book = found ? await catalog.cacheCover(found) : null;
    if (!book) throw new AppError('NOT_FOUND', 'Book not found in the catalog.');
    const shelfEntryId = await findCatalogEntryId(c.get('db'), c.get('session').user.id, book);
    return c.json({ book, shelfEntryId });
  });

  routes.get(API_ROUTES.catalogIsbn, async (c) => {
    const isbn13 = toIsbn13(c.req.param('isbn'));
    if (!isbn13) {
      throw new AppError('VALIDATION_FAILED', 'Invalid ISBN.', {
        issues: [{ path: 'isbn', message: 'Must be a valid ISBN-10 or ISBN-13.' }],
      });
    }
    const catalog = deps.catalog(c);
    const found = await catalog.lookupIsbn(isbn13);
    const book = found ? await catalog.cacheCover(found) : null;
    if (!book) throw new AppError('NOT_FOUND', 'No book found for this ISBN.');
    const shelfEntryId = await findCatalogEntryId(c.get('db'), c.get('session').user.id, book);
    return c.json({ book, shelfEntryId });
  });

  return routes;
}

/** Resolves a catalog id to server-side metadata (never trusts client-sent book data). */
export async function resolveCatalogBook(catalog: CatalogService, catalogId: string) {
  const book = await catalog.getBook(catalogId);
  if (!book) throw new AppError('NOT_FOUND', 'Book not found in the catalog.');
  return catalog.cacheCover(book);
}
