import { createAuthClient } from 'better-auth/react';

// In development, Vite proxies /api to the backend — use the frontend's own origin
// so requests stay same-origin (no CORS, cookies just work).
// In production, use the explicit API URL.
const baseURL = import.meta.env.DEV
  ? window.location.origin
  : import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const authClient = createAuthClient({
  baseURL,
  ...(!import.meta.env.DEV && {
    fetchOptions: { credentials: 'include' },
  }),
});

export type Session = typeof authClient.$Infer.Session;
