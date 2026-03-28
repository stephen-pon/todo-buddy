import { hc } from 'hono/client';
import type { AppType } from '@todo-buddy/backend';

// In dev, Vite proxies /api to the backend so '/' works.
// In production, VITE_API_URL points to the backend origin (e.g. https://api.kiniva.app).
const baseURL = import.meta.env.VITE_API_URL || '/';

export const client = hc<AppType>(baseURL, {
  fetch: (input: RequestInfo | URL, init?: RequestInit) =>
    fetch(input, { ...init, credentials: 'include' }),
});
