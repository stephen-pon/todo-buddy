import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';

export function errorHandler(err: Error, c: Context) {
  console.error('Error:', err);

  if (err instanceof HTTPException) {
    return c.json({ error: err.message, status: err.status }, err.status);
  }

  if (err instanceof ZodError) {
    return c.json(
      {
        error: 'Validation failed',
        issues: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
      400,
    );
  }

  if (err.message?.includes('duplicate key') || err.message?.includes('unique constraint')) {
    return c.json({ error: 'A record with this information already exists' }, 409);
  }

  if (err.message?.includes('foreign key constraint')) {
    return c.json({ error: 'Cannot complete operation — related records exist' }, 409);
  }

  return c.json(
    {
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
    },
    500,
  );
}
