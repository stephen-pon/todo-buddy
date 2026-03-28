# Todo List — Design Spec

## Overview

A flat, reorderable todo list with optional due dates. The first feature in Todo Buddy's incrementally evolving productivity surface.

## Data Model

### `todos` table

| Column       | SQL Column     | Type    | Constraints                          |
|--------------|----------------|---------|--------------------------------------|
| `id`         | `id`           | UUID    | PK, `defaultRandom()`               |
| `title`      | `title`        | text    | NOT NULL                             |
| `completed`  | `completed`    | boolean | NOT NULL, default `false`            |
| `dueDate`    | `due_date`     | date    | nullable (calendar date, no time)    |
| `sortOrder`  | `sort_order`   | integer | NOT NULL                             |
| `userId`     | `user_id`      | UUID    | NOT NULL, FK -> `user.id`, cascade   |
| `createdAt`  | `created_at`   | timestamp | NOT NULL, auto                     |
| `updatedAt`  | `updated_at`   | timestamp | NOT NULL, auto-update              |

Compound index on `(user_id, sort_order)` for efficient filtered+sorted queries.

`sortOrder` has no database default — the backend always computes `max(sortOrder for user) + 1` on insert.

### Relations

- `todosRelations`: each todo belongs to one `user` (via `userId`)
- `userRelations` in `auth-schema.ts` must be extended to include `todos: many(todos)`

### TypeScript interface

```typescript
import type { UUID, ISODateString, Nullable } from './common';

export interface Todo {
  id: UUID;
  title: string;
  completed: boolean;
  dueDate: Nullable<string>;  // "YYYY-MM-DD" or null
  sortOrder: number;
  userId: UUID;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
```

## API Routes

All endpoints mounted at `/api/todos`. All endpoints filter by the authenticated user's ID — todos are private per-user data.

| Method | Path                | Body                              | Description                        |
|--------|---------------------|-----------------------------------|------------------------------------|
| GET    | `/`                 | —                                 | List user's todos, ordered by `sortOrder` ASC |
| POST   | `/`                 | `{ title, dueDate? }`            | Create todo, auto-assign sortOrder |
| PUT    | `/:id`              | `{ title?, completed?, dueDate? }` | Update a todo (ownership verified) |
| DELETE | `/:id`              | —                                 | Delete a todo (ownership verified) |
| POST   | `/reorder`          | `{ items: { id, sortOrder }[] }` | Batch update sort order (in a transaction) |
| POST   | `/clear-completed`  | —                                 | Delete all completed todos for the authenticated user |

### Authorization

- GET `/` filters by `userId = currentUser.id`
- PUT `/:id` and DELETE `/:id` verify the todo's `userId` matches `currentUser.id`, return 403 if not
- POST `/reorder` validates all IDs in the array belong to the authenticated user, wrapped in a transaction
- POST `/clear-completed` scoped to `userId = currentUser.id`

### Error responses

- `404 { error: 'Todo not found' }` — ID does not exist
- `403 { error: 'Forbidden' }` — todo belongs to another user

## Shared Schemas (Zod)

- `createTodoSchema` — `{ title: z.string().min(1).max(255), dueDate: z.string().date().optional() }`
- `updateTodoSchema` — `{ title: z.string().min(1).max(255).optional(), completed: z.boolean().optional(), dueDate: z.string().date().nullable().optional() }`
- `reorderTodosSchema` — `{ items: z.array(z.object({ id: z.string().uuid(), sortOrder: z.number().int() })).min(1) }`

Setting `dueDate` to `null` in an update clears it. Omitting `dueDate` leaves it unchanged.

## Frontend

### Page: `TodosPage`

Replaces the dashboard as the main authenticated landing page (`/` and `/dashboard` routes).

**Layout:**
- Inline input field + optional date picker + "Add" button at the top
- Todo list below, each item showing:
  - Drag handle (left)
  - Checkbox (toggles completed)
  - Title (strikethrough when completed)
  - Due date badge (if set)
  - Delete button (visible on hover)
- "Clear completed" button at the bottom, only visible when completed todos exist

**Behavior:**
- Completed todos stay in place with strikethrough styling
- Drag-to-reorder via `@dnd-kit/core` + `@dnd-kit/sortable`
- On drag end, send only the affected items with their new `sortOrder` values via `POST /reorder`
- Optimistic updates via React Query for responsive feel
- No inline title editing in v1

### Dependencies to add
- `@dnd-kit/core`
- `@dnd-kit/sortable`
- `@dnd-kit/utilities`

## Files to Create/Modify

1. `shared/types/todo.ts` — Todo interface
2. `shared/schemas/todo.ts` — Zod schemas (create, update, reorder)
3. `shared/index.ts` — Add barrel exports
4. `backend/src/db/schema.ts` — `todos` table + `todosRelations`
5. `backend/src/db/auth-schema.ts` — Extend `userRelations` with `todos: many(todos)`
6. `backend/src/routes/todos.ts` — Chained Hono routes (6 endpoints)
7. `backend/src/index.ts` — Mount `/api/todos` route
8. `frontend/src/pages/TodosPage.tsx` — Main todo list page
9. `frontend/src/App.tsx` — Replace dashboard route with todos
10. `frontend/src/components/Layout.tsx` — Update nav link

## Out of Scope (future iterations)

- Inline title editing
- Priority levels
- Multiple lists / projects
- Tags / categories
- Recurring todos
- Search / filter
