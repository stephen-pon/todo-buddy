import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { auth } from './lib/auth';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';
import type { Variables } from './types/hono';
import todosRoute from './routes/todos';

const app = new Hono<{ Variables: Variables }>();

// Global middleware
app.use('*', logger());

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((origin) => origin.trim())
  : ['http://localhost:5173'];

app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return origin;
      return allowedOrigins.includes(origin) ? origin : null;
    },
    credentials: true,
  }),
);

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Better-auth routes (unprotected)
app.all('/api/auth/*', async (c) => {
  return await auth.handler(c.req.raw);
});

// Auth middleware for all other /api routes
app.use('/api/*', async (c, next) => {
  if (c.req.path.startsWith('/api/auth/')) {
    return next();
  }
  return authMiddleware(c, next);
});

// Mount API routes — chain on a single variable for Hono RPC type inference
// Example: const routes = app.route('/api/posts', postsRoute);
const routes = app.route('/api/todos', todosRoute);

// Global error handler
app.onError(errorHandler);

// Export app type for Hono RPC client
export type AppType = typeof routes;

const port = parseInt(process.env.PORT || '3000', 10);

serve({
  fetch: app.fetch,
  port,
  hostname: '0.0.0.0',
});

console.log(`Server running on http://localhost:${port}`);
