import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getPool } from '../db';
import { route } from '../router';

// One catch-all HTTP function: GET /api/<anything> is handled by the shared router.
app.http('api', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: '{*path}',
  handler: async (req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const result = await route(getPool(), req.params.path ?? '', new URL(req.url).searchParams);
      return { status: result.status, jsonBody: result.body, headers: { 'Cache-Control': 'public, max-age=60' } };
    } catch (err) {
      ctx.error('API error', err);
      return { status: 500, jsonBody: { error: 'Internal server error' } };
    }
  },
});
