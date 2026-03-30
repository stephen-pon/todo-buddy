# Today Column Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers-extended-cc:subagent-driven-development (if subagents available) or superpowers-extended-cc:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Today" column next to the todo list so users can drag items into it to set daily focus intentions.

**Architecture:** Add an `isToday` boolean to the existing todo data model. The single GET endpoint returns all todos; the frontend splits them into two columns by `isToday`. Cross-column drag uses dnd-kit's multi-container support, calling the existing PUT endpoint to flip the flag.

**Tech Stack:** Drizzle ORM (migration), Zod (schema), @dnd-kit/core + @dnd-kit/sortable (multi-container DnD), Tailwind CSS 4 (responsive layout)

**Spec:** `docs/superpowers/specs/2026-03-30-today-column-design.md`

---

### Task 0: Add `isToday` to shared types and schemas

**Files:**
- Modify: `shared/types/todo.ts:3-12`
- Modify: `shared/schemas/todo.ts:8-12`

- [ ] **Step 1: Add `isToday` to the Todo type**

In `shared/types/todo.ts`, add `isToday` field:

```typescript
export interface Todo {
  id: UUID;
  title: string;
  completed: boolean;
  dueDate: Nullable<string>;
  isToday: boolean;
  sortOrder: number;
  userId: UUID;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
```

- [ ] **Step 2: Add `isToday` to updateTodoSchema**

In `shared/schemas/todo.ts`, add to `updateTodoSchema`:

```typescript
export const updateTodoSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255).optional(),
  completed: z.boolean().optional(),
  dueDate: z.string().date().nullable().optional(),
  isToday: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
```

Note: `sortOrder` is also added here so the frontend can send `{ isToday, sortOrder }` in a single PUT for cross-column moves.

- [ ] **Step 3: Run typecheck**

Run: `pnpm run typecheck`
Expected: May have errors in frontend (Todo type now expects `isToday`) — that's fine, we'll fix those in later tasks.

- [ ] **Step 4: Commit**

```bash
git add shared/types/todo.ts shared/schemas/todo.ts
git commit -m "feat: add isToday field to Todo type and update schema"
```

---

### Task 1: Add `isToday` column to database schema

**Files:**
- Modify: `backend/src/db/schema.ts:25-43`

- [ ] **Step 1: Add `isToday` column to todos table**

In `backend/src/db/schema.ts`, add after the `completed` field (line 30):

```typescript
isToday: boolean('is_today').default(false).notNull(),
```

- [ ] **Step 2: Push schema to database**

Run: `pnpm run db:push`
Expected: Drizzle applies the migration, adding the `is_today` column.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/schema.ts
git commit -m "feat: add is_today column to todos table"
```

---

### Task 2: Update backend routes for `isToday` support

**Files:**
- Modify: `backend/src/routes/todos.ts:22-43` (POST create)
- Modify: `backend/src/routes/todos.ts:45-62` (PUT update — already works, just verify)

The PUT route already does `db.update(todos).set(data)` where `data` comes from `updateTodoSchema`. Since we added `isToday` and `sortOrder` to that schema, the PUT endpoint automatically supports `{ isToday: true, sortOrder: 5 }` with no code changes.

- [ ] **Step 1: Verify PUT route handles isToday**

Read `backend/src/routes/todos.ts:45-62` and confirm the PUT route uses `zValidator('json', updateTodoSchema)` and passes `data` directly to `.set(data)`. No change needed — the schema update in Task 0 is sufficient.

- [ ] **Step 2: Start the dev server and test**

Run: `pnpm run dev` (if not already running)

Test with curl:
```bash
curl -s http://localhost:3000/api/todos -H "X-Test-Bypass: true" | head -c 200
```
Expected: Todos returned, each now has `isToday: false`.

- [ ] **Step 3: Commit (if any changes were needed)**

No backend code changes expected for this task — the schema change in Task 0 handles it. Skip commit if no changes.

---

### Task 3: Refactor TodosPage into two-column layout with cross-container DnD

This is the main frontend task. The current `TodosPage.tsx` is a single-list page. We need to:
1. Split todos into two lists by `isToday`
2. Render two columns (desktop) or tabs (mobile)
3. Support cross-column drag-and-drop
4. Support within-column reordering

**Files:**
- Modify: `frontend/src/pages/TodosPage.tsx` (major refactor)

- [ ] **Step 1: Add the `useMediaQuery` hook for responsive behavior**

Create a minimal hook inline or at the top of the file. We need to detect `< 768px` for the tab switcher.

Add to the top of `TodosPage.tsx` (below imports):

```typescript
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);
  return matches;
}
```

Add `useEffect` to the imports from React.

- [ ] **Step 2: Split todos into two lists and add column state**

Inside the `TodosPage` component, after the existing `useQuery`, add:

```typescript
const isMobile = useMediaQuery('(max-width: 767px)');
const [activeTab, setActiveTab] = useState<'todos' | 'today'>('todos');

const backlogTodos = todos.filter((t) => !t.isToday);
const todayTodos = todos.filter((t) => t.isToday);
```

- [ ] **Step 3: Add cross-column move mutation**

Add a new mutation for moving items between columns (uses the existing PUT endpoint):

```typescript
const moveMutation = useMutation({
  mutationFn: async ({ id, isToday, sortOrder }: { id: string; isToday: boolean; sortOrder: number }) => {
    const res = await client.api.todos[':id'].$put({
      param: { id },
      json: { isToday, sortOrder },
    });
    if (!res.ok) throw new Error('Failed to move todo');
    return res.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['todos'] });
  },
});
```

- [ ] **Step 4: Update `handleDragEnd` for multi-container support**

Replace the existing `handleDragEnd` with logic that detects whether the drag is within-column or cross-column:

```typescript
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  if (!over) return;

  const activeId = active.id as string;
  const overId = over.id as string;

  const activeTodo = todos.find((t) => t.id === activeId);
  if (!activeTodo) return;

  // Determine which column the item is being dropped into
  const isOverTodayColumn =
    overId === 'today-droppable' ||
    todayTodos.some((t) => t.id === overId);
  const isOverBacklogColumn =
    overId === 'backlog-droppable' ||
    backlogTodos.some((t) => t.id === overId);

  const targetIsToday = isOverTodayColumn;
  const targetIsBacklog = isOverBacklogColumn;

  // Cross-column move
  if (activeTodo.isToday && targetIsBacklog) {
    const maxOrder = backlogTodos.length > 0
      ? Math.max(...backlogTodos.map((t) => t.sortOrder))
      : 0;
    // Optimistic update
    queryClient.setQueryData(['todos'], (old: Todo[]) =>
      old.map((t) =>
        t.id === activeId ? { ...t, isToday: false, sortOrder: maxOrder + 1 } : t
      )
    );
    moveMutation.mutate(
      { id: activeId, isToday: false, sortOrder: maxOrder + 1 },
      { onError: () => queryClient.invalidateQueries({ queryKey: ['todos'] }) }
    );
    return;
  }

  if (!activeTodo.isToday && targetIsToday) {
    const maxOrder = todayTodos.length > 0
      ? Math.max(...todayTodos.map((t) => t.sortOrder))
      : 0;
    queryClient.setQueryData(['todos'], (old: Todo[]) =>
      old.map((t) =>
        t.id === activeId ? { ...t, isToday: true, sortOrder: maxOrder + 1 } : t
      )
    );
    moveMutation.mutate(
      { id: activeId, isToday: true, sortOrder: maxOrder + 1 },
      { onError: () => queryClient.invalidateQueries({ queryKey: ['todos'] }) }
    );
    return;
  }

  // Within-column reorder
  if (activeId === overId) return;

  const sourceList = activeTodo.isToday ? todayTodos : backlogTodos;
  const oldIndex = sourceList.findIndex((t) => t.id === activeId);
  const newIndex = sourceList.findIndex((t) => t.id === overId);
  if (oldIndex === -1 || newIndex === -1) return;

  const reordered = arrayMove(sourceList, oldIndex, newIndex);

  // Optimistic update — rebuild the full list
  const otherList = activeTodo.isToday ? backlogTodos : todayTodos;
  const newReordered = reordered.map((t, i) => ({ ...t, sortOrder: i }));
  queryClient.setQueryData(['todos'], [...otherList, ...newReordered]);

  const items = newReordered
    .filter((t, i) => t.sortOrder !== sourceList[sourceList.findIndex((s) => s.id === t.id)]?.sortOrder)
    .map((t) => ({ id: t.id, sortOrder: t.sortOrder }));

  if (items.length > 0) {
    reorderMutation.mutate(items, {
      onError: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
    });
  }
};
```

- [ ] **Step 5: Update DndContext to use `closestCorners` and add droppable columns**

Change the import from `closestCenter` to `closestCorners`:

```typescript
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
```

- [ ] **Step 6: Create the `DroppableColumn` wrapper component**

Add above the `TodosPage` component:

```typescript
function DroppableColumn({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id });
  return <div ref={setNodeRef}>{children}</div>;
}
```

Add `useDroppable` to the dnd-kit imports:

```typescript
import { useDroppable } from '@dnd-kit/core';
```

- [ ] **Step 7: Add the mobile toggle handler**

```typescript
const handleToggleToday = (id: string, currentIsToday: boolean) => {
  const targetList = currentIsToday ? backlogTodos : todayTodos;
  const maxOrder = targetList.length > 0
    ? Math.max(...targetList.map((t) => t.sortOrder))
    : 0;
  // Optimistic update
  queryClient.setQueryData(['todos'], (old: Todo[]) =>
    old.map((t) =>
      t.id === id ? { ...t, isToday: !currentIsToday, sortOrder: maxOrder + 1 } : t
    )
  );
  moveMutation.mutate(
    { id, isToday: !currentIsToday, sortOrder: maxOrder + 1 },
    { onError: () => queryClient.invalidateQueries({ queryKey: ['todos'] }) }
  );
};
```

- [ ] **Step 8: Update `SortableTodoItem` to accept mobile toggle**

Update the component props and add the toggle button:

```typescript
function SortableTodoItem({
  todo,
  onToggle,
  onDelete,
  onToggleToday,
  isMobile,
}: {
  todo: Todo;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onToggleToday?: (id: string, currentIsToday: boolean) => void;
  isMobile?: boolean;
}) {
```

Add the toggle button inside the item, before the delete button:

```tsx
{isMobile && onToggleToday && (
  <button
    onClick={() => onToggleToday(todo.id, todo.isToday)}
    className="text-sm text-muted-foreground hover:text-amber-500"
    aria-label={todo.isToday ? 'Move to backlog' : 'Move to today'}
    title={todo.isToday ? 'Move to backlog' : 'Move to today'}
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {todo.isToday ? (
        <path d="M19 12H5M12 5l-7 7 7 7" />
      ) : (
        <path d="M12 3v6l3-3M12 3 9 6M12 3a9 9 0 1 1-9 9" />
      )}
    </svg>
  </button>
)}
```

- [ ] **Step 9: Rewrite the JSX return for two-column / tab layout**

Replace the return statement with:

```tsx
return (
  <div className="space-y-4">
    <div>
      <h1 className="text-2xl font-bold">Todos</h1>
    </div>

    {/* Mobile tab switcher */}
    {isMobile && (
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('todos')}
          className={`flex-1 pb-2 text-sm font-medium ${
            activeTab === 'todos'
              ? 'border-b-2 border-primary text-foreground'
              : 'text-muted-foreground'
          }`}
        >
          Todos ({backlogTodos.length})
        </button>
        <button
          onClick={() => setActiveTab('today')}
          className={`flex-1 pb-2 text-sm font-medium ${
            activeTab === 'today'
              ? 'border-b-2 border-amber-500 text-foreground'
              : 'text-muted-foreground'
          }`}
        >
          Today ({todayTodos.length})
        </button>
      </div>
    )}

    {isLoading ? (
      <p className="text-muted-foreground">Loading...</p>
    ) : (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={handleDragEnd}
      >
        {isMobile ? (
          /* Mobile: show active tab */
          <div>
            {activeTab === 'todos' && (
              <>
                <form onSubmit={handleSubmit} className="mb-4 flex items-center gap-2">
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="What needs to be done?"
                    className="flex h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <button
                    type="submit"
                    disabled={createMutation.isPending || !newTitle.trim()}
                    className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    Add
                  </button>
                </form>
                <DroppableColumn id="backlog-droppable">
                  <SortableContext items={backlogTodos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {backlogTodos.length > 0 ? (
                        backlogTodos.map((todo) => (
                          <div key={todo.id} className="group">
                            <SortableTodoItem
                              todo={todo}
                              onToggle={(id, completed) => updateMutation.mutate({ id, completed })}
                              onDelete={(id) => deleteMutation.mutate(id)}
                              onToggleToday={handleToggleToday}
                              isMobile={true}
                            />
                          </div>
                        ))
                      ) : (
                        <p className="py-8 text-center text-sm text-muted-foreground">No todos yet. Add one above!</p>
                      )}
                    </div>
                  </SortableContext>
                </DroppableColumn>
              </>
            )}
            {activeTab === 'today' && (
              <DroppableColumn id="today-droppable">
                <SortableContext items={todayTodos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {todayTodos.length > 0 ? (
                      todayTodos.map((todo) => (
                        <div key={todo.id} className="group">
                          <SortableTodoItem
                            todo={todo}
                            onToggle={(id, completed) => updateMutation.mutate({ id, completed })}
                            onDelete={(id) => deleteMutation.mutate(id)}
                            onToggleToday={handleToggleToday}
                            isMobile={true}
                          />
                        </div>
                      ))
                    ) : (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        No tasks for today. Switch to Todos and tap the sun icon to add some!
                      </p>
                    )}
                  </div>
                </SortableContext>
              </DroppableColumn>
            )}
          </div>
        ) : (
          /* Desktop: two columns */
          <div className="flex gap-6">
            {/* Left column: Backlog */}
            <div className="flex-1 space-y-4">
              <h2 className="text-lg font-semibold">Todos</h2>
              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="What needs to be done?"
                  className="flex h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <button
                  type="submit"
                  disabled={createMutation.isPending || !newTitle.trim()}
                  className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  Add
                </button>
              </form>
              <DroppableColumn id="backlog-droppable">
                <SortableContext items={backlogTodos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="min-h-[100px] space-y-2">
                    {backlogTodos.length > 0 ? (
                      backlogTodos.map((todo) => (
                        <div key={todo.id} className="group">
                          <SortableTodoItem
                            todo={todo}
                            onToggle={(id, completed) => updateMutation.mutate({ id, completed })}
                            onDelete={(id) => deleteMutation.mutate(id)}
                          />
                        </div>
                      ))
                    ) : (
                      <div className="flex min-h-[100px] items-center justify-center rounded-lg border-2 border-dashed border-border">
                        <p className="text-sm text-muted-foreground">All items moved to Today</p>
                      </div>
                    )}
                  </div>
                </SortableContext>
              </DroppableColumn>
            </div>

            {/* Right column: Today */}
            <div className="flex-1 space-y-4">
              <h2 className="text-lg font-semibold text-amber-500">Today</h2>
              <DroppableColumn id="today-droppable">
                <SortableContext items={todayTodos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="min-h-[100px] space-y-2">
                    {todayTodos.length > 0 ? (
                      todayTodos.map((todo) => (
                        <div key={todo.id} className="group">
                          <SortableTodoItem
                            todo={todo}
                            onToggle={(id, completed) => updateMutation.mutate({ id, completed })}
                            onDelete={(id) => deleteMutation.mutate(id)}
                          />
                        </div>
                      ))
                    ) : (
                      <div className="flex min-h-[100px] items-center justify-center rounded-lg border-2 border-dashed border-border">
                        <p className="text-sm text-muted-foreground">Drag todos here to focus on them today</p>
                      </div>
                    )}
                  </div>
                </SortableContext>
              </DroppableColumn>
            </div>
          </div>
        )}
      </DndContext>
    )}

    {hasCompleted && (
      <button
        onClick={() => clearCompletedMutation.mutate()}
        disabled={clearCompletedMutation.isPending}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        Clear completed
      </button>
    )}
  </div>
);
```

- [ ] **Step 10: Run typecheck and dev server**

Run: `pnpm run typecheck`
Expected: PASS — no type errors.

Open the app in browser, verify:
- Two columns visible on desktop
- Tab switcher on narrow viewport
- Existing todos appear in the left/Todos column

- [ ] **Step 11: Commit**

```bash
git add frontend/src/pages/TodosPage.tsx
git commit -m "feat: add Today column with two-column layout and cross-container DnD"
```

---

### Task 4: Manual testing and polish

- [ ] **Step 1: Test cross-column drag (desktop)**

1. Create 3-4 todos
2. Drag one from Todos to Today — it should disappear from left, appear in right
3. Drag it back — it should return to Todos
4. Drag into empty Today column — should work (drop zone visible)

- [ ] **Step 2: Test within-column reorder**

1. Add 3 items to Today
2. Reorder them by dragging — sort order should persist after page refresh

- [ ] **Step 3: Test mobile tab switcher**

1. Resize browser to < 768px
2. Tabs should appear ("Todos" / "Today" with counts)
3. Tap toggle button on a todo — it should move to the other tab
4. Switch tabs to verify

- [ ] **Step 4: Test completion and clear**

1. Complete a todo in Today column — shows strikethrough
2. Complete a todo in Todos column — shows strikethrough
3. Click "Clear completed" — removes completed from both columns

- [ ] **Step 5: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 6: Final commit (if any polish changes)**

```bash
git add -A
git commit -m "fix: polish Today column edge cases"
```
