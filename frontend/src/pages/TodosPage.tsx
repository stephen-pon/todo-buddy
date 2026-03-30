import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { client } from '../lib/api';
import type { Todo } from '@todo-buddy/shared';

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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        aria-label="Drag to reorder"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="3" r="1.5" />
          <circle cx="11" cy="3" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="13" r="1.5" />
          <circle cx="11" cy="13" r="1.5" />
        </svg>
      </button>

      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => onToggle(todo.id, !todo.completed)}
        className="h-4 w-4 rounded border-input"
      />

      <span
        className={`flex-1 text-sm ${todo.completed ? 'text-muted-foreground line-through' : ''}`}
      >
        {todo.title}
      </span>

      {todo.dueDate && (
        <span className="text-xs text-muted-foreground">
          {new Date(todo.dueDate + 'T00:00:00').toLocaleDateString()}
        </span>
      )}

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

      <button
        onClick={() => onDelete(todo.id)}
        className="text-sm text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:[.group:hover_&]:opacity-100"
        aria-label="Delete todo"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

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

export default function TodosPage() {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const { data: todos = [], isLoading } = useQuery({
    queryKey: ['todos'],
    queryFn: async () => {
      const res = await client.api.todos.$get();
      if (!res.ok) throw new Error('Failed to fetch todos');
      return res.json();
    },
  });

  const isMobile = useMediaQuery('(max-width: 767px)');
  const [activeTab, setActiveTab] = useState<'todos' | 'today'>('todos');

  const backlogTodos = todos.filter((t) => !t.isToday);
  const todayTodos = todos.filter((t) => t.isToday);

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; dueDate?: string }) => {
      const res = await client.api.todos.$post({ json: data });
      if (!res.ok) throw new Error('Failed to create todo');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      setNewTitle('');
      setNewDueDate('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; completed?: boolean }) => {
      const res = await client.api.todos[':id'].$put({
        param: { id },
        json: data,
      });
      if (!res.ok) throw new Error('Failed to update todo');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await client.api.todos[':id'].$delete({ param: { id } });
      if (!res.ok) throw new Error('Failed to delete todo');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (items: { id: string; sortOrder: number }[]) => {
      const res = await client.api.todos.reorder.$post({ json: { items } });
      if (!res.ok) throw new Error('Failed to reorder todos');
    },
  });

  const clearCompletedMutation = useMutation({
    mutationFn: async () => {
      const res = await client.api.todos['clear-completed'].$post();
      if (!res.ok) throw new Error('Failed to clear completed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    createMutation.mutate({
      title: newTitle.trim(),
      ...(newDueDate ? { dueDate: newDueDate } : {}),
    });
  };

  const handleToggleToday = (id: string, currentIsToday: boolean) => {
    const targetList = currentIsToday ? backlogTodos : todayTodos;
    const maxOrder = targetList.length > 0
      ? Math.max(...targetList.map((t) => t.sortOrder))
      : 0;
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTodo = todos.find((t) => t.id === activeId);
    if (!activeTodo) return;

    const isOverTodayColumn =
      overId === 'today-droppable' ||
      todayTodos.some((t) => t.id === overId);
    const isOverBacklogColumn =
      overId === 'backlog-droppable' ||
      backlogTodos.some((t) => t.id === overId);

    // Cross-column move: Today -> Backlog
    if (activeTodo.isToday && isOverBacklogColumn) {
      const maxOrder = backlogTodos.length > 0
        ? Math.max(...backlogTodos.map((t) => t.sortOrder))
        : 0;
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

    // Cross-column move: Backlog -> Today
    if (!activeTodo.isToday && isOverTodayColumn) {
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

    const otherList = activeTodo.isToday ? backlogTodos : todayTodos;
    const newReordered = reordered.map((t, i) => ({ ...t, sortOrder: i }));
    queryClient.setQueryData(['todos'], [...otherList, ...newReordered]);

    const items = newReordered
      .filter((t) => {
        const original = sourceList.find((s) => s.id === t.id);
        return original && t.sortOrder !== original.sortOrder;
      })
      .map((t) => ({ id: t.id, sortOrder: t.sortOrder }));

    if (items.length > 0) {
      reorderMutation.mutate(items, {
        onError: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
      });
    }
  };

  const hasCompleted = todos.some((t) => t.completed);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Todos</h1>
      </div>

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
            <div className="flex gap-6">
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
}
