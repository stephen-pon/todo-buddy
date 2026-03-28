# Todo List — Design Spec

## Overview

A flat, reorderable todo list with optional due dates. The first feature in Todo Buddy's incrementally evolving productivity surface.

## Data Model

### `todos` table

| Column      | Type      | Constraints                          |
|-------------|-----------|--------------------------------------|
| `id`        | UUID      | PK, `defaultRandom()`               |
| `title`     | text      | NOT NULL                             |
| `completed` | boolean   | NOT NULL, default `false`            |
| `dueDate`   | timestamp | nullable                             |
| `sortOrder` | integer   | NOT NULL, default `0`                |
| `userId`    | UUID      | NOT NULL, FK -> `user.id`, cascade   |
| `createdAt` | timestamp | NOT NULL, auto                       |
| `updatedAt` | timestamp | NOT NULL, auto-update                |

Index on `userId` for query performance.

New todos receive `sortOrder = max(existing) + 1` so they appear at the bottom of the list.

## API Routes

All endpoints mounted at `/api/todos`, scoped to the authenticated user.

| Method | Path                | Body                              | Description                        |
|--------|---------------------|-----------------------------------|------------------------------------|
| GET    | `/`                 | —                                 | List todos, ordered by `sortOrder` ASC |
| POST   | `/`                 | `{ title, dueDate? }`            | Create todo, auto-assign sortOrder |
| PUT    | `/:id`              | `{ title?, completed?, dueDate? }` | Update a todo                    |
| DELETE | `/:id`              | —                                 | Delete a single todo               |
| POST   | `/reorder`          | `{ items: { id, sortOrder }[] }` | Batch update sort order            |
| POST   | `/clear-completed`  | —                                 | Delete all completed todos         |

## Shared Schemas (Zod)

- `createTodoSchema` — `{ title: string (min 1, max 255), dueDate?: string (ISO date, optional) }`
- `updateTodoSchema` — `{ title?: string, completed?: boolean, dueDate?: string | null }`
- `reorderTodosSchema` — `{ items: { id: string (UUID), sortOrder: number }[] }`

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
- On drag end, compute new `sortOrder` values and fire `POST /reorder`
- Optimistic updates via React Query for responsive feel
- No inline title editing in v1

### Dependencies to add
- `@dnd-kit/core`
- `@dnd-kit/sortable`
- `@dnd-kit/utilities`

## Files to Create/Modify

1. `shared/types/todo.ts` — Todo interface
2. `shared/schemas/todo.ts` — Zod schemas
3. `shared/index.ts` — Add barrel exports
4. `backend/src/db/schema.ts` — `todos` table + relations
5. `backend/src/routes/todos.ts` — Chained Hono routes (6 endpoints)
6. `backend/src/index.ts` — Mount `/api/todos` route
7. `frontend/src/pages/TodosPage.tsx` — Main todo list page
8. `frontend/src/App.tsx` — Replace dashboard route with todos
9. `frontend/src/components/Layout.tsx` — Update nav link

## Out of Scope (future iterations)

- Inline title editing
- Priority levels
- Multiple lists / projects
- Tags / categories
- Recurring todos
- Search / filter
