import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
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
  onRemoveFromInbox,
  projectId,
  isMobile,
}: {
  todo: Todo;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onToggleToday?: (id: string, currentIsToday: boolean) => void;
  onRemoveFromInbox?: (id: string) => void;
  projectId?: string | null;
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

      {onRemoveFromInbox && projectId && (
        <button
          onClick={() => onRemoveFromInbox(todo.id)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Remove from inbox"
          title="Remove from inbox (back to project only)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
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

function ProjectCard({
  project,
  onDelete,
  onToggleTodo,
  onDeleteTodo,
  onPushToInbox,
  newTodoTitle,
  onNewTodoTitleChange,
  onCreateTodo,
}: {
  project: {
    id: string;
    name: string;
    todos: Todo[];
  };
  onDelete: (id: string) => void;
  onToggleTodo: (id: string, completed: boolean) => void;
  onDeleteTodo: (id: string) => void;
  onPushToInbox: (id: string, inInbox: boolean) => void;
  newTodoTitle: string;
  onNewTodoTitleChange: (value: string) => void;
  onCreateTodo: (title: string, projectId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const handleDelete = () => {
    const todoCount = project.todos.length;
    const message = todoCount > 0
      ? `Delete "${project.name}" and its ${todoCount} todo${todoCount === 1 ? '' : 's'}? This cannot be undone.`
      : `Delete "${project.name}"? This cannot be undone.`;
    if (window.confirm(message)) {
      onDelete(project.id);
    }
  };

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center gap-2 p-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground hover:text-foreground"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
        <span className="flex-1 text-sm font-medium">{project.name}</span>
        <span className="text-xs text-muted-foreground">{project.todos.length}</span>
        <button
          onClick={handleDelete}
          className="text-sm text-muted-foreground hover:text-destructive"
          aria-label="Delete project"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      {expanded && (
        <div className="space-y-2 px-3 pb-3">
          {project.todos.map((todo) => (
            <div key={todo.id} className="group flex items-center gap-2 rounded border border-border/50 p-2">
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => onToggleTodo(todo.id, !todo.completed)}
                className="h-4 w-4 rounded border-input"
              />
              <span
                className={`flex-1 text-sm ${todo.completed ? 'text-muted-foreground line-through' : ''}`}
              >
                {todo.title}
              </span>
              {!todo.inInbox ? (
                <button
                  onClick={() => onPushToInbox(todo.id, true)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Push to inbox"
                  title="Push to inbox"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              ) : (
                <span className="text-xs text-muted-foreground" title="In inbox">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                    <path d="M22 12h-6l-2 3H10l-2-3H2" />
                    <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
                  </svg>
                </span>
              )}
              <button
                onClick={() => onDeleteTodo(todo.id)}
                className="text-sm text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                aria-label="Delete todo"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newTodoTitle.trim()) {
                onCreateTodo(newTodoTitle.trim(), project.id);
              }
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={newTodoTitle}
              onChange={(e) => onNewTodoTitleChange(e.target.value)}
              placeholder="Add todo..."
              className="flex h-8 flex-1 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <button
              type="submit"
              disabled={!newTodoTitle.trim()}
              className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
            >
              Add
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default function TodosPage() {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');

  const [activeTodo, setActiveTodo] = useState<Todo | null>(null);

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

  const { data: projectsData = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await client.api.projects.$get();
      if (!res.ok) throw new Error('Failed to fetch projects');
      return res.json();
    },
  });

  const [newProjectName, setNewProjectName] = useState('');

  const createProjectMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await client.api.projects.$post({ json: { name } });
      if (!res.ok) throw new Error('Failed to create project');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setNewProjectName('');
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await client.api.projects[':id'].$delete({ param: { id } });
      if (!res.ok) throw new Error('Failed to delete project');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });

  const pushToInboxMutation = useMutation({
    mutationFn: async ({ id, inInbox }: { id: string; inInbox: boolean }) => {
      const res = await client.api.todos[':id'].$put({
        param: { id },
        json: { inInbox },
      });
      if (!res.ok) throw new Error('Failed to update todo');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const [projectTodoInputs, setProjectTodoInputs] = useState<Record<string, string>>({});

  const createProjectTodoMutation = useMutation({
    mutationFn: async ({ title, projectId }: { title: string; projectId: string }) => {
      const res = await client.api.todos.$post({
        json: { title, projectId, inInbox: false },
      });
      if (!res.ok) throw new Error('Failed to create todo');
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setProjectTodoInputs((prev) => ({ ...prev, [variables.projectId]: '' }));
    },
  });

  const isMobile = useMediaQuery('(max-width: 767px)');
  const [activeTab, setActiveTab] = useState<'projects' | 'todos' | 'today'>('todos');

  const backlogFromServer = todos.filter(
    (t) => !t.isToday && (t.projectId === null || t.inInbox),
  );
  const todayFromServer = todos.filter((t) => t.isToday);

  // Local state for drag-in-progress reordering
  const [localBacklog, setLocalBacklog] = useState<Todo[] | null>(null);
  const [localToday, setLocalToday] = useState<Todo[] | null>(null);

  const backlogTodos = localBacklog ?? backlogFromServer;
  const todayTodos = localToday ?? todayFromServer;

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; dueDate?: string }) => {
      const res = await client.api.todos.$post({ json: data });
      if (!res.ok) throw new Error('Failed to create todo');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
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
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await client.api.todos[':id'].$delete({ param: { id } });
      if (!res.ok) throw new Error('Failed to delete todo');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (items: { id: string; sortOrder: number }[]) => {
      const res = await client.api.todos.reorder.$post({
        json: { context: 'inbox' as const, items },
      });
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
      queryClient.invalidateQueries({ queryKey: ['projects'] });
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
      queryClient.invalidateQueries({ queryKey: ['projects'] });
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

  const handleDragStart = (event: DragStartEvent) => {
    const todo = todos.find((t) => t.id === event.active.id);
    setActiveTodo(todo ?? null);
    // Snapshot current lists for local manipulation during drag
    setLocalBacklog(backlogFromServer);
    setLocalToday(todayFromServer);
  };

  const findContainer = (id: string): 'backlog' | 'today' | null => {
    if (id === 'backlog-droppable') return 'backlog';
    if (id === 'today-droppable') return 'today';
    if (backlogTodos.some((t) => t.id === id)) return 'backlog';
    if (todayTodos.some((t) => t.id === id)) return 'today';
    return null;
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);

    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    // Move item between containers in local state
    const sourceList = activeContainer === 'backlog' ? [...backlogTodos] : [...todayTodos];
    const destList = overContainer === 'backlog' ? [...backlogTodos] : [...todayTodos];

    const activeIndex = sourceList.findIndex((t) => t.id === activeId);
    if (activeIndex === -1) return;

    const movedItem = sourceList[activeIndex]!;
    sourceList.splice(activeIndex, 1);
    const updatedItem = { ...movedItem, isToday: overContainer === 'today' };

    // Insert at the position of the item being hovered, or at end if hovering the droppable
    const overIndex = destList.findIndex((t) => t.id === overId);
    if (overIndex >= 0) {
      destList.splice(overIndex, 0, updatedItem);
    } else {
      destList.push(updatedItem);
    }

    if (activeContainer === 'backlog') {
      setLocalBacklog(sourceList);
      setLocalToday(destList);
    } else {
      setLocalToday(sourceList);
      setLocalBacklog(destList);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // Finalize local state into the query cache
    const finalBacklog = backlogTodos;
    const finalToday = todayTodos;

    // Clear local drag state
    setLocalBacklog(null);
    setLocalToday(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeContainer = findContainer(activeId);

    // Handle within-column reorder
    if (activeId !== overId && activeContainer) {
      const list = activeContainer === 'backlog' ? [...finalBacklog] : [...finalToday];
      const oldIndex = list.findIndex((t) => t.id === activeId);
      const newIndex = list.findIndex((t) => t.id === overId);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(list, oldIndex, newIndex);
        const withOrder = reordered.map((t, i) => ({ ...t, sortOrder: i }));
        const otherList = activeContainer === 'backlog' ? finalToday : finalBacklog;
        queryClient.setQueryData(['todos'], [...otherList, ...withOrder]);

        const items = withOrder
          .filter((t) => {
            const original = list.find((s) => s.id === t.id);
            return original && t.sortOrder !== original.sortOrder;
          })
          .map((t) => ({ id: t.id, sortOrder: t.sortOrder }));

        if (items.length > 0) {
          reorderMutation.mutate(items, {
            onError: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
          });
        }
        return;
      }
    }

    // Check if item crossed containers (comparing to server state)
    const originalTodo = todos.find((t) => t.id === activeId);
    if (!originalTodo) return;

    const nowInToday = finalToday.some((t) => t.id === activeId);
    const wasInToday = originalTodo.isToday;

    if (nowInToday !== wasInToday) {
      // Persist with sort orders
      const targetList = nowInToday ? finalToday : finalBacklog;
      const withOrder = targetList.map((t, i) => ({ ...t, sortOrder: i }));
      const otherList = nowInToday ? finalBacklog : finalToday;
      queryClient.setQueryData(['todos'], [...otherList, ...withOrder]);

      const movedTodo = withOrder.find((t) => t.id === activeId);
      moveMutation.mutate(
        { id: activeId, isToday: nowInToday, sortOrder: movedTodo?.sortOrder ?? 0 },
        { onError: () => queryClient.invalidateQueries({ queryKey: ['todos'] }) }
      );
    }
  };

  const hasCompleted = todos.some((t) => t.completed);

  const projectsColumn = (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Projects</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newProjectName.trim()) {
            createProjectMutation.mutate(newProjectName.trim());
          }
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          placeholder="New project..."
          className="flex h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <button
          type="submit"
          disabled={createProjectMutation.isPending || !newProjectName.trim()}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {projectsData.length > 0 ? (
        <div className="space-y-3">
          {projectsData.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={(id) => deleteProjectMutation.mutate(id)}
              onToggleTodo={(id, completed) => updateMutation.mutate({ id, completed })}
              onDeleteTodo={(id) => deleteMutation.mutate(id)}
              onPushToInbox={(id, inInbox) => pushToInboxMutation.mutate({ id, inInbox })}
              newTodoTitle={projectTodoInputs[project.id] ?? ''}
              onNewTodoTitleChange={(value) =>
                setProjectTodoInputs((prev) => ({ ...prev, [project.id]: value }))
              }
              onCreateTodo={(title, projectId) =>
                createProjectTodoMutation.mutate({ title, projectId })
              }
            />
          ))}
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground">No projects yet</p>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Todo Buddy</h1>
      </div>

      {isMobile && (
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('projects')}
            className={`flex-1 pb-2 text-sm font-medium ${
              activeTab === 'projects'
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground'
            }`}
          >
            Projects ({projectsData.length})
          </button>
          <button
            onClick={() => setActiveTab('todos')}
            className={`flex-1 pb-2 text-sm font-medium ${
              activeTab === 'todos'
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground'
            }`}
          >
            Inbox ({backlogTodos.length})
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
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={(event) => {
            handleDragEnd(event);
            setActiveTodo(null);
          }}
          onDragCancel={() => {
            setActiveTodo(null);
            setLocalBacklog(null);
            setLocalToday(null);
          }}
        >
          {isMobile ? (
            <div>
              {activeTab === 'projects' && projectsColumn}
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
                                onRemoveFromInbox={(id) => pushToInboxMutation.mutate({ id, inInbox: false })}
                                projectId={todo.projectId}
                                isMobile={true}
                              />
                            </div>
                          ))
                        ) : (
                          <p className="py-8 text-center text-sm text-muted-foreground">No inbox items</p>
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
                          No tasks for today. Switch to Inbox and tap the sun icon to add some!
                        </p>
                      )}
                    </div>
                  </SortableContext>
                </DroppableColumn>
              )}
            </div>
          ) : (
            <div className="flex gap-6">
              <div className="w-72 shrink-0">
                {projectsColumn}
              </div>

              <div className="flex-1 space-y-4">
                <h2 className="text-lg font-semibold">Inbox</h2>
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
                              onRemoveFromInbox={(id) => pushToInboxMutation.mutate({ id, inInbox: false })}
                              projectId={todo.projectId}
                            />
                          </div>
                        ))
                      ) : (
                        <div className="flex min-h-[100px] items-center justify-center rounded-lg border-2 border-dashed border-border">
                          <p className="text-sm text-muted-foreground">No inbox items</p>
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
          <DragOverlay dropAnimation={null}>
            {activeTodo ? (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 shadow-lg">
                <span className="cursor-grabbing text-muted-foreground">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <circle cx="5" cy="3" r="1.5" />
                    <circle cx="11" cy="3" r="1.5" />
                    <circle cx="5" cy="8" r="1.5" />
                    <circle cx="11" cy="8" r="1.5" />
                    <circle cx="5" cy="13" r="1.5" />
                    <circle cx="11" cy="13" r="1.5" />
                  </svg>
                </span>
                <input
                  type="checkbox"
                  checked={activeTodo.completed}
                  readOnly
                  className="h-4 w-4 rounded border-input"
                />
                <span className={`flex-1 text-sm ${activeTodo.completed ? 'text-muted-foreground line-through' : ''}`}>
                  {activeTodo.title}
                </span>
                {activeTodo.dueDate && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(activeTodo.dueDate + 'T00:00:00').toLocaleDateString()}
                  </span>
                )}
              </div>
            ) : null}
          </DragOverlay>
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
