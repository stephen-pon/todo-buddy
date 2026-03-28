import { createAuthClient } from 'better-auth/react';

// better-auth client expects the server origin — it appends /api/auth automatically
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const authClient = createAuthClient({
  baseURL,
  fetchOptions: {
    credentials: 'include',
  },
});

export type Session = typeof authClient.$Infer.Session;
