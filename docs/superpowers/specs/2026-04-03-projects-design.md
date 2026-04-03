# Projects Feature Design

## Overview

Add a "Projects" layer of organization above todos. A project contains many todos. Todos can optionally be "pushed" to the inbox to surface them for active work, creating a left-to-right workflow: Projects -> Inbox -> Today.

## Data Model

### New Table: `projects`

| Column      | Type        | Constraints                          |
|-------------|-------------|--------------------------------------|
| id          | UUID        | PK, defaultRandom()                 |
| name        | text        | NOT NULL                             |
| sortOrder   | integer     | NOT NULL                             |
| userId      | UUID        | NOT NULL, FK -> user.id (cascade)    |
| createdAt   | timestamp   | NOT NULL, defaultNow()              |
| updatedAt   | timestamp   | NOT NULL, defaultNow(), auto-update |

Index: `(userId, sortOrder)`

### Modified Table: `todos`

Three new columns:

| Column           | Type    | Constraints                                      |
|------------------|---------|--------------------------------------------------|
| projectId        | UUID    | Nullable, FK -> projects.id (cascade delete)     |
| inInbox          | boolean | NOT NULL, default false                          |
| projectSortOrder | integer | Nullable                                         |

- `projectSortOrder` controls ordering within a project's todo list, independent of `sortOrder`.
- `sortOrder` (existing) continues to control ordering in inbox and today columns.
- When a project todo is created, it gets a `projectSortOrder`. It only gets a `sortOrder` when pushed to inbox or today.
- When a project is deleted, all its todos are cascade-deleted with it.

### Relationships

- `projects` -> `todos`: one-to-many
- `user` -> `projects`: one-to-many

### Query Logic

- **Project list**: todos WHERE `projectId = :projectId`, ordered by `projectSortOrder`
- **Inbox column**: todos WHERE (`projectId IS NULL`) OR (`inInbox = true`), ordered by `sortOrder`
- **Today column**: unchanged — todos WHERE `isToday = true`, ordered by `sortOrder`

A project todo with `inInbox = true` AND `isToday = true` appears in all three views. Completion in any view marks the single underlying record as complete.

### Sort Order Details

- Todos created directly in the inbox: get `sortOrder`, no `projectSortOrder`.
- Todos created in a project: get `projectSortOrder`. When pushed to inbox (`inInbox = true`), they are assigned a `sortOrder` (prepended to inbox). Reordering in inbox changes `sortOrder`; reordering in the project list changes `projectSortOrder`. The two are independent.
- The reorder endpoint (`POST /api/todos/reorder`) needs a `context` field (`"inbox"` or `"project"`) to know which sort field to update.

## Shared Types & Schemas

### `shared/types/project.ts`

```typescript
interface Project {
  id: UUID;
  name: string;
  sortOrder: number;
  userId: UUID;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
```

### `shared/schemas/project.ts`

- `createProjectSchema`: `{ name: string (min 1, max 255) }`
- `updateProjectSchema`: `{ name?: string (min 1, max 255) }`

### Modified `shared/types/todo.ts`

Add to existing `Todo` interface:
- `projectId: Nullable<string>`
- `inInbox: boolean`
- `projectSortOrder: Nullable<number>`

### Modified `shared/schemas/todo.ts`

Add to `createTodoSchema`:
- `projectId`: optional UUID string
- `inInbox`: optional boolean

Add to `updateTodoSchema`:
- `projectId`: optional nullable UUID string
- `inInbox`: optional boolean
- `projectSortOrder`: optional integer

Modify `reorderTodosSchema`:
- Add `context` field: `"inbox"` | `"project"` (required) — determines whether `sortOrder` or `projectSortOrder` is updated
- When `context = "project"`, items contain `{ id, projectSortOrder }`
- When `context = "inbox"`, items contain `{ id, sortOrder }` (also used for today column reordering since both use `sortOrder`)

## Backend API

### New Routes: `/api/projects`

| Method | Path                    | Description                        |
|--------|-------------------------|------------------------------------|
| GET    | /api/projects           | List all user projects (with todos)|
| POST   | /api/projects           | Create a new project               |
| PUT    | /api/projects/:id       | Update project name                |
| DELETE | /api/projects/:id       | Delete project (cascades todos)    |

GET `/api/projects` returns projects ordered by `sortOrder`, each with nested `todos` array ordered by `projectSortOrder`.

New project `sortOrder` is assigned by prepending (min existing sortOrder - 1).

### Modified Routes: `/api/todos`

- POST `/api/todos` accepts optional `projectId` and `inInbox` fields. When `projectId` is provided, auto-assigns `projectSortOrder`.
- PUT `/api/todos/:id` accepts optional `projectId`, `inInbox`, and `projectSortOrder` fields. When setting `inInbox = true`, also assigns a `sortOrder` (prepend to inbox) if the todo doesn't already have one.
- POST `/api/todos/reorder` now requires a `context` field (`"inbox"` | `"project"`) and updates the corresponding sort field.
- GET `/api/todos` continues to return all user todos (frontend filters by column).

### Frontend Query Invalidation

Both `['projects']` and `['todos']` query keys must be invalidated when a todo is created, updated, deleted, or reordered — since todo data appears in both the projects and inbox/today views.

### Clear Completed Behavior

`POST /api/todos/clear-completed` deletes all completed todos for the user, including project todos. This is intentional — completed work is done regardless of where it lives.

## Frontend UI

### Desktop Layout: Three Columns

```
+------------------+------------------+------------------+
|    Projects      |      Inbox       |      Today       |
|                  |                  |                  |
| [+ New project]  | [+ New todo]     |                  |
|                  |                  |                  |
| > Project A      | [ ] Buy milk     | [ ] Call dentist |
|   [ ] Task 1  -> | [ ] Task 2   *   |                  |
|   [ ] Task 2     |                  |                  |
|                  |                  |                  |
| > Project B      |                  |                  |
|   [ ] Task 3  -> |                  |                  |
+------------------+------------------+------------------+

-> = "push to inbox" button (on project todos not yet in inbox)
<- = "remove from inbox" button (on inbox items that have a projectId)
*  = indicates this todo came from a project (has projectId)
```

- **Projects column**: Collapsible project cards. Each project has a header (name + delete button) and an expandable todo list. Each project todo has a right-arrow button to push it to inbox (`inInbox = true`); if already in inbox, the arrow is hidden or replaced with a visual indicator. Text input at top to create new projects. Text input inside each expanded project to create todos within it.
- **Inbox column**: Renamed from "Todos". Shows todos where `projectId IS NULL` OR `inInbox = true`. Drag-and-drop reordering preserved. Inbox items that came from a project (have a `projectId`) show a left-arrow button to remove them from inbox (`inInbox = false`), returning them to project-only.
- **Today column**: Unchanged. Drag-and-drop preserved.

### Mobile Layout

Three tabs: Projects | Inbox | Today

Projects tab shows the same collapsible project cards.

### Delete Confirmation

Deleting a project shows a confirmation dialog warning that all todos in the project will also be deleted. Uses a simple `window.confirm()` or a shadcn AlertDialog.

### Drag-and-Drop

No DnD changes for this iteration. Existing inbox <-> today DnD is preserved. Projects column uses button-based interactions only (push to inbox, create, delete).

## Backward Compatibility

- Existing todos have `projectId = NULL` and `inInbox = false`.
- They continue to appear in the inbox column (the `projectId IS NULL` clause).
- No migration of existing data needed beyond adding the new columns with defaults.

## Files to Create/Modify

### New Files
1. `shared/types/project.ts`
2. `shared/schemas/project.ts`
3. `backend/src/routes/projects.ts`

### Modified Files
4. `shared/types/todo.ts` — add `projectId`, `inInbox`, `projectSortOrder`
5. `shared/schemas/todo.ts` — add fields to create/update schemas
6. `shared/index.ts` — add project exports
7. `backend/src/db/schema.ts` — add `projects` table, relations, modify `todos`
8. `backend/src/index.ts` — mount projects route
9. `frontend/src/pages/TodosPage.tsx` — three-column layout, projects column, rename "Todos" to "Inbox"
