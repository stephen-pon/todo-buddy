# Today Column — Design Spec

## Summary

Add a "Today" column alongside the existing todo list. Users drag todos into Today to set daily intentions. Items live in exactly one column at a time. Items in Today persist indefinitely until manually moved back or completed — there is no automatic daily reset.

## Data Model

- Add `isToday` boolean column to `todos` table (default `false`, not null)
- Add `isToday` to `UpdateTodoSchema` in shared schemas
- Add `isToday` to the `Todo` TypeScript type
- No new tables or endpoints

## API Changes

- `GET /api/todos` — no change; returns all todos sorted by `sortOrder`. Frontend splits by `isToday` and sorts each group independently.
- `PUT /api/todos/:id` — already supports partial updates; now accepts `isToday` and `sortOrder` together. The frontend calculates the new `sortOrder` and sends `{ isToday: true/false, sortOrder: N }` in a single PUT when moving cross-column.
- `POST /api/todos/reorder` — no change; only the items within the affected column are sent.

## Frontend Layout

### Desktop (≥768px): Two Equal Columns

- Flex container with two 50/50 columns, gap between them
- **Left column ("Todos"):** header, add form, sortable list of todos where `isToday === false`
- **Right column ("Today"):** header, sortable list of todos where `isToday === true`
- Both columns show an empty-state drop zone when they have no items (e.g., "Drag todos here" placeholder)

### Mobile (<768px): Tab Switcher

- Two tabs at top: "Todos" / "Today"
- Only the active tab's list is visible
- Add form only shows on the Todos tab
- Each todo item shows a mobile-only toggle button (sun icon or similar) to move it to/from Today, since cross-column drag isn't available

## Drag-and-Drop

- Single `DndContext` wrapping both columns
- Each column is a separate droppable container using `useDroppable`
- Each column has its own `SortableContext` with `verticalListSortingStrategy`
- Use `closestCorners` collision detection (instead of current `closestCenter`) for proper multi-container drop detection including empty containers
- **Within-column drag:** reorders using existing reorder mutation (only affected column's items sent)
- **Cross-column drag:** frontend calculates `sortOrder = max(target column sortOrders) + 1`, then calls PUT with `{ isToday: true/false, sortOrder: N }` in a single request

### Optimistic Updates

- **Within-column reorder:** same as today — update React Query cache immediately, rollback on error
- **Cross-column drag:** optimistically move the item between the two filtered lists in the cache, send PUT, rollback both lists on error

## Sort Order

- `sortOrder` is a single integer field; values may overlap across columns and that is fine since the frontend filters by `isToday` before sorting
- When moving to another column, the frontend computes `max(sortOrder of items in target column) + 1`
- New todos get `min(all user sortOrders) - 1` as today — this is fine since the frontend filters per-column
- Within-column reordering works exactly as today

## Completion Behavior

- Completed items show with strikethrough in whichever column they're in
- "Clear completed" deletes all completed todos regardless of column (existing behavior, no change)

## New Todos

- New todos are always created with `isToday = false` (land in the Todos column)
- Add form only appears in the Todos column / tab
