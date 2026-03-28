import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../db/client';

const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET;
const BETTER_AUTH_URL = process.env.BETTER_AUTH_URL;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

if (!BETTER_AUTH_SECRET) {
  throw new Error('BETTER_AUTH_SECRET environment variable is required');
}

if (!BETTER_AUTH_URL) {
  throw new Error('BETTER_AUTH_URL environment variable is required');
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  secret: BETTER_AUTH_SECRET,
  baseURL: BETTER_AUTH_URL,
  trustedOrigins: [FRONTEND_URL],
  emailAndPassword: {
    enabled: true,
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  ...(process.env.COOKIE_DOMAIN && {
    cookies: {
      sessionToken: {
        options: {
          domain: process.env.COOKIE_DOMAIN,
          secure: true,
          sameSite: 'none' as const,
          path: '/',
        },
      },
      state: {
        options: {
          domain: process.env.COOKIE_DOMAIN,
          secure: true,
          sameSite: 'none' as const,
          path: '/',
        },
      },
      pkceCodeVerifier: {
        options: {
          domain: process.env.COOKIE_DOMAIN,
          secure: true,
          sameSite: 'none' as const,
          path: '/',
        },
      },
    },
  }),
  advanced: {
    database: {
      generateId: 'uuid',
    },
  },
});
