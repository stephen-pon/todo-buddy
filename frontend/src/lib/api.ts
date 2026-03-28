import { hc } from 'hono/client';
import type { AppType } from '@todo-buddy/backend';

// In dev, Vite proxies /api to the backend, so base URL is just '/'
export const client = hc<AppType>('/');
