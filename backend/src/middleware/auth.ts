import type { Context, Next } from 'hono';
import { auth } from '../lib/auth';

export async function authMiddleware(c: Context, next: Next) {
  try {
    // Dev bypass
    if (process.env.NODE_ENV === 'development' && c.req.header('X-Test-Bypass') === 'true') {
      c.set('user', {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
      });
      c.set('session', {
        id: 'test-session-id',
        userId: 'test-user-id',
      });
      await next();
      return;
    }

    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    c.set('user', session.user);
    c.set('session', session.session);

    await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return c.json({ error: 'Unauthorized' }, 401);
  }
}
