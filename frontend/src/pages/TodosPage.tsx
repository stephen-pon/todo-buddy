import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
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

function SortableTodoItem({
  todo,
  onToggle,
  onDelete,
}: {
  todo: Todo;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    createMutation.mutate({
      title: newTitle.trim(),
      ...(newDueDate ? { dueDate: newDueDate } : {}),
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = todos.findIndex((t) => t.id === active.id);
    const newIndex = todos.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(todos, oldIndex, newIndex);

    // Optimistically update the cache
    queryClient.setQueryData(['todos'], reordered);

    // Send only the items whose sortOrder changed
    const items = reordered
      .map((todo, i) => ({ id: todo.id, sortOrder: i }))
      .filter((item) => item.sortOrder !== todos[todos.findIndex((t) => t.id === item.id)]?.sortOrder);

    reorderMutation.mutate(items, {
      onError: () => {
        queryClient.invalidateQueries({ queryKey: ['todos'] });
      },
    });
  };

  const hasCompleted = todos.some((t) => t.completed);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Todos</h1>
      </div>

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

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : todos.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={todos.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {todos.map((todo) => (
                <div key={todo.id} className="group">
                  <SortableTodoItem
                    todo={todo}
                    onToggle={(id, completed) =>
                      updateMutation.mutate({ id, completed })
                    }
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <p className="text-muted-foreground">No todos yet. Add one above!</p>
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
