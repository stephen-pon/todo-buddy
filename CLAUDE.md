# Todo Buddy — LLM Context

## Project Vision

Todo Buddy is an incrementally evolving productivity app. The goal is to experiment with different features and configurations to find the optimal personal productivity setup. Features are added iteratively — start simple, validate what works, then build on it.

## Architecture

Full-stack TypeScript monorepo with three packages:
- **shared** (`@todo-buddy/shared`) — Zod schemas, TypeScript types
- **backend** (`@todo-buddy/backend`) — Hono 4 API server with better-auth
- **frontend** (`@todo-buddy/frontend`) — Vite 6 + React 19 SPA

## Tech Stack

- **Runtime**: Node.js 20, pnpm workspaces
- **Backend**: Hono 4, Hono RPC, Drizzle ORM, postgres.js, better-auth, Zod
- **Frontend**: React 19, React Router 7, React Query 5, Tailwind CSS 4, shadcn/ui, Hono RPC client
- **Database**: PostgreSQL 16 (Docker Compose)
- **Language**: TypeScript strict mode throughout

## Key Patterns

### Hono RPC (End-to-End Type Safety)
- Backend routes are **chained** on a single Hono instance so TypeScript can infer the full route type.
- `backend/src/index.ts` exports `AppType` (the type of the app after all routes are mounted).
- `frontend/src/lib/api.ts` creates a typed client via `hc<AppType>('/')`.
- Frontend calls look like: `client.api.posts.$get()` — fully typed request and response.
- **When adding a new entity**: create the route file with chained methods, mount it in `index.ts` on the `routes` chain, and the frontend client automatically picks up the types.

### Auth Flow
- `better-auth` handles `/api/auth/*` (sign up, sign in, session, sign out).
- Auth middleware protects all other `/api/*` routes, attaching `user` and `session` to context.
- Frontend uses `authClient.useSession()` hook to check auth state.
- `ProtectedRoute` component wraps authenticated pages and redirects to `/login`.
- Dev bypass: `X-Test-Bypass: true` header skips auth in development.

### Shared Validation
- Zod schemas live in `shared/schemas/` and are imported by both backend and frontend.
- Backend uses `@hono/zod-validator` (`zValidator('json', schema)`).
- Frontend uses `@hookform/resolvers/zod` for form validation.

### Database Conventions
- UUID primary keys with `defaultRandom()`.
- `createdAt`/`updatedAt` timestamps on every table.
- `$onUpdate(() => new Date())` for auto-updating `updatedAt`.
- Drizzle `relations()` defined alongside table schemas.

### File Conventions
- Route files: `backend/src/routes/{entity}.ts` — one file per entity, chained Hono routes.
- Type files: `shared/types/{entity}.ts` — TypeScript interfaces.
- Schema files: `shared/schemas/{entity}.ts` — Zod validation schemas.
- Page files: `frontend/src/pages/{EntityName}Page.tsx` — one file per page.

## Commands

```bash
pnpm run dev          # Start both servers
pnpm run typecheck    # Type-check all packages
pnpm run db:push      # Push schema to database
pnpm run db:seed      # Seed sample data
```

## Pre-Completion Checklist

Before finalizing any code change, always run `pnpm run typecheck` and confirm it passes. This catches unused imports, type errors, and other issues that would break the production build.

## Adding a New Entity

1. **shared/types/{entity}.ts** — Define TypeScript types
2. **shared/schemas/{entity}.ts** — Define Zod create/update schemas
3. **shared/index.ts** — Add barrel exports
4. **backend/src/db/schema.ts** — Add Drizzle table + relations
5. **backend/src/routes/{entity}.ts** — Create chained Hono routes
6. **backend/src/index.ts** — Mount route on the `routes` chain (before `AppType` export)
7. **frontend/src/pages/{Entity}Page.tsx** — Create page with RPC client + React Query
8. **frontend/src/App.tsx** — Add route + nav link in Layout

## Environment Variables

### Backend (.env)
- `DATABASE_URL` — PostgreSQL connection string
- `BETTER_AUTH_SECRET` — Auth secret key
- `BETTER_AUTH_URL` — Backend base URL (http://localhost:3000)
- `FRONTEND_URL` — Frontend URL for CORS (http://localhost:5173)
- `PORT` — Server port (default: 3000)

### Frontend (.env)
- `VITE_API_URL` — Backend API URL (http://localhost:3000)

---

## Full-Stack Example: "Posts" CRUD Entity

This is a complete reference for adding a CRUD entity. Follow this pattern when creating new entities.

### 1. shared/types/post.ts

```typescript
import type { UUID, ISODateString } from './common';

export interface Post {
  id: UUID;
  title: string;
  content: string;
  userId: UUID;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface PostWithUser extends Post {
  user: {
    id: UUID;
    name: string;
    email: string;
  };
}
```

### 2. shared/schemas/post.ts

```typescript
import { z } from 'zod';

export const createPostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  content: z.string().min(1, 'Content is required'),
});

export const updatePostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255).optional(),
  content: z.string().min(1, 'Content is required').optional(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
```

### 3. shared/index.ts — add exports

```typescript
export * from './types/post';
export * from './schemas/post';
```

### 4. backend/src/db/schema.ts — add table + relations

```typescript
import { user } from './auth-schema';

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('posts_userId_idx').on(table.userId)],
);

// Add to userRelations:
//   posts: many(posts),

export const postsRelations = relations(posts, ({ one }) => ({
  user: one(user, {
    fields: [posts.userId],
    references: [user.id],
  }),
}));
```

### 5. backend/src/routes/posts.ts — chained Hono routes

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { posts } from '../db/schema';
import { createPostSchema, updatePostSchema } from '@todo-buddy/shared';
import type { Variables } from '../types/hono';

const postsRoute = new Hono<{ Variables: Variables }>()
  .get('/', async (c) => {
    const allPosts = await db.query.posts.findMany({
      orderBy: [desc(posts.createdAt)],
      with: {
        user: {
          columns: { id: true, name: true, email: true },
        },
      },
    });
    return c.json(allPosts);
  })
  .get('/:id', async (c) => {
    const id = c.req.param('id');
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, id),
      with: {
        user: {
          columns: { id: true, name: true, email: true },
        },
      },
    });
    if (!post) return c.json({ error: 'Post not found' }, 404);
    return c.json(post);
  })
  .post('/', zValidator('json', createPostSchema), async (c) => {
    const data = c.req.valid('json');
    const currentUser = c.get('user');
    const [newPost] = await db
      .insert(posts)
      .values({ title: data.title, content: data.content, userId: currentUser.id })
      .returning();
    return c.json(newPost, 201);
  })
  .put('/:id', zValidator('json', updatePostSchema), async (c) => {
    const id = c.req.param('id');
    const data = c.req.valid('json');
    const currentUser = c.get('user');
    const existing = await db.query.posts.findFirst({ where: eq(posts.id, id) });
    if (!existing) return c.json({ error: 'Post not found' }, 404);
    if (existing.userId !== currentUser.id) return c.json({ error: 'Forbidden' }, 403);
    const [updated] = await db.update(posts).set(data).where(eq(posts.id, id)).returning();
    return c.json(updated);
  })
  .delete('/:id', async (c) => {
    const id = c.req.param('id');
    const currentUser = c.get('user');
    const existing = await db.query.posts.findFirst({ where: eq(posts.id, id) });
    if (!existing) return c.json({ error: 'Post not found' }, 404);
    if (existing.userId !== currentUser.id) return c.json({ error: 'Forbidden' }, 403);
    await db.delete(posts).where(eq(posts.id, id));
    return c.json({ success: true });
  });

export default postsRoute;
```

### 6. backend/src/index.ts — mount route

```typescript
import postsRoute from './routes/posts';

// Change: const routes = app;
// To:
const routes = app.route('/api/posts', postsRoute);
```

### 7. frontend/src/pages/PostsPage.tsx — full CRUD page

```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createPostSchema, type CreatePostInput } from '@todo-buddy/shared';
import { client } from '../lib/api';

export default function PostsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: posts, isLoading } = useQuery({
    queryKey: ['posts'],
    queryFn: async () => {
      const res = await client.api.posts.$get();
      if (!res.ok) throw new Error('Failed to fetch posts');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreatePostInput) => {
      const res = await client.api.posts.$post({ json: data });
      if (!res.ok) throw new Error('Failed to create post');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setShowForm(false);
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await client.api.posts[':id'].$delete({ param: { id } });
      if (!res.ok) throw new Error('Failed to delete post');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreatePostInput>({
    resolver: zodResolver(createPostSchema),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Posts</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          {showForm ? 'Cancel' : 'New Post'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="space-y-4 rounded-lg border border-border p-4">
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">Title</label>
            <input id="title" {...register('title')} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" placeholder="Post title" />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <label htmlFor="content" className="text-sm font-medium">Content</label>
            <textarea id="content" {...register('content')} rows={4} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm" placeholder="Write your post..." />
            {errors.content && <p className="text-sm text-destructive">{errors.content.message}</p>}
          </div>
          <button type="submit" disabled={createMutation.isPending} className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50">
            {createMutation.isPending ? 'Creating...' : 'Create Post'}
          </button>
        </form>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Loading posts...</p>
      ) : posts && posts.length > 0 ? (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold">{post.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    by {post.user.name} &middot; {new Date(post.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button onClick={() => deleteMutation.mutate(post.id)} className="text-sm text-muted-foreground hover:text-destructive">
                  Delete
                </button>
              </div>
              <p className="mt-2 text-sm">{post.content}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No posts yet. Create your first one!</p>
      )}
    </div>
  );
}
```

### 8. frontend/src/App.tsx — add route

```tsx
import PostsPage from './pages/PostsPage';

// Add inside <Routes>:
<Route path="/posts" element={<ProtectedRoute><PostsPage /></ProtectedRoute>} />
```

### 9. frontend/src/components/Layout.tsx — add nav link

```tsx
<Link to="/posts" className="text-sm text-muted-foreground hover:text-foreground">
  Posts
</Link>
```
