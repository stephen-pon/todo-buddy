import { useState, useEffect, useRef } from 'react';
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
  onAssignToProject,
  onPushToInbox,
  projectId,
  projects,
  compact,
  isMobile,
}: {
  todo: Todo;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onToggleToday?: (id: string, currentIsToday: boolean) => void;
  onRemoveFromInbox?: (id: string) => void;
  onAssignToProject?: (id: string, projectId: string) => void;
  onPushToInbox?: (id: string, inInbox: boolean) => void;
  projectId?: string | null;
  projects?: { id: string; name: string }[];
  compact?: boolean;
  isMobile?: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({ id: todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: 'transform 50ms ease',
    opacity: isDragging ? 0.3 : 1,
  };

  const iconSize = compact ? 12 : 16;

  return (
      <div
        ref={setNodeRef}
        style={style}
        className={compact
          ? 'group flex items-center gap-2 rounded border border-border/50 p-2'
          : 'group flex items-center gap-3 rounded-lg border border-border bg-background p-3'
        }
      >
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          aria-label="Drag to reorder"
        >
          <svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill="currentColor">
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

        <span className="flex flex-1 items-baseline gap-2">
          <span
            className={`text-sm ${todo.completed ? 'text-muted-foreground line-through' : ''}`}
          >
            {todo.title}
          </span>
          {projectId && projects && (() => {
            const project = projects.find((p) => p.id === projectId);
            return project ? (
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {project.name}
              </span>
            ) : null;
          })()}
        </span>

        {todo.dueDate && (
          <span className="text-xs text-muted-foreground">
            {new Date(todo.dueDate + 'T00:00:00').toLocaleDateString()}
          </span>
        )}

        {onPushToInbox && !todo.inInbox && (
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
        )}

        {onPushToInbox && todo.inInbox && (
          <span className="text-xs text-muted-foreground" title="In inbox">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
              <path d="M22 12h-6l-2 3H10l-2-3H2" />
              <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
            </svg>
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

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Actions"
          >
            <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
          {showMenu && (
            <div className="absolute right-0 top-7 z-10 min-w-[180px] rounded-md border border-border bg-background p-1 shadow-md">
              {onAssignToProject && !projectId && projects && projects.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Assign to project</div>
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        onAssignToProject(todo.id, p.id);
                        setShowMenu(false);
                      }}
                      className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                      </svg>
                      {p.name}
                    </button>
                  ))}
                  <div className="my-1 border-t border-border" />
                </>
              )}
              {onRemoveFromInbox && projectId && (
                <>
                  <button
                    onClick={() => {
                      onRemoveFromInbox(todo.id);
                      setShowMenu(false);
                    }}
                    className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Remove from inbox
                  </button>
                  <div className="my-1 border-t border-border" />
                </>
              )}
              <button
                onClick={() => {
                  onDelete(todo.id);
                  setShowMenu(false);
                }}
                className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-sm text-destructive hover:bg-muted"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
  );
}

function TodoList({
  droppableId,
  todos,
  onToggle,
  onDelete,
  onToggleToday,
  onRemoveFromInbox,
  onAssignToProject,
  projects,
  emptyText,
  isMobile,
}: {
  droppableId: string;
  todos: Todo[];
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onToggleToday?: (id: string, currentIsToday: boolean) => void;
  onRemoveFromInbox?: (id: string) => void;
  onAssignToProject?: (id: string, projectId: string) => void;
  projects?: { id: string; name: string }[];
  emptyText: string;
  isMobile?: boolean;
}) {
  return (
    <DroppableColumn id={droppableId}>
      <SortableContext items={todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className={isMobile ? 'space-y-2' : 'min-h-[100px] space-y-2'}>
          {todos.length > 0 ? (
            todos.map((todo) => (
              <div key={todo.id} className="group">
                <SortableTodoItem
                  todo={todo}
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onToggleToday={onToggleToday}
                  onRemoveFromInbox={onRemoveFromInbox}
                  onAssignToProject={onAssignToProject}
                  projectId={todo.projectId}
                  projects={projects}
                  isMobile={isMobile}
                />
              </div>
            ))
          ) : isMobile ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{emptyText}</p>
          ) : (
            <div className="flex min-h-[100px] items-center justify-center rounded-lg border-2 border-dashed border-border">
              <p className="text-sm text-muted-foreground">{emptyText}</p>
            </div>
          )}
        </div>
      </SortableContext>
    </DroppableColumn>
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
  onReorder,
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
  onReorder: (items: { id: string; sortOrder: number }[], onSettled: () => void) => void;
  newTodoTitle: string;
  onNewTodoTitleChange: (value: string) => void;
  onCreateTodo: (title: string, projectId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [localTodos, setLocalTodos] = useState<Todo[] | null>(null);
  const displayTodos = localTodos ?? project.todos;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDelete = () => {
    const todoCount = project.todos.length;
    const message = todoCount > 0
      ? `Delete "${project.name}" and its ${todoCount} todo${todoCount === 1 ? '' : 's'}? This cannot be undone.`
      : `Delete "${project.name}"? This cannot be undone.`;
    if (window.confirm(message)) {
      onDelete(project.id);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const todos = displayTodos;
    const oldIndex = todos.findIndex((t) => t.id === active.id);
    const newIndex = todos.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(todos, oldIndex, newIndex);
    setLocalTodos(reordered);

    const items = reordered.map((t, i) => ({ id: t.id, sortOrder: i }));
    onReorder(items, () => setLocalTodos(null));
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={displayTodos.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {displayTodos.map((todo) => (
                <div key={todo.id} className="group">
                  <SortableTodoItem
                    todo={todo}
                    onToggle={(id, completed) => onToggleTodo(id, completed)}
                    onDelete={(id) => onDeleteTodo(id)}
                    onPushToInbox={onPushToInbox}
                    compact
                  />
                </div>
              ))}
            </SortableContext>
          </DndContext>
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

  const assignToProjectMutation = useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const res = await client.api.todos[':id'].$put({
        param: { id },
        json: { projectId, inInbox: true },
      });
      if (!res.ok) throw new Error('Failed to assign to project');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
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

  const projectReorderMutation = useMutation({
    mutationFn: async (items: { id: string; sortOrder: number }[]) => {
      const res = await client.api.todos.reorder.$post({
        json: { context: 'projectSortOrder' as const, items },
      });
      if (!res.ok) throw new Error('Failed to reorder project todos');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const isMobile = useMediaQuery('(max-width: 767px)');
  const [activeTab, setActiveTab] = useState<'projects' | 'todos' | 'today'>('todos');

  const backlogTodos = todos.filter(
    (t) => !t.isToday && (t.projectId === null || t.inInbox),
  );
  const todayTodos = todos.filter((t) => t.isToday);

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
        json: { context: 'sortOrder' as const, items },
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

  // Local state for drag-in-progress reordering
  const [localBacklog, setLocalBacklog] = useState<Todo[] | null>(null);
  const [localToday, setLocalToday] = useState<Todo[] | null>(null);

  const displayBacklog = localBacklog ?? backlogTodos;
  const displayToday = localToday ?? todayTodos;

  const findContainer = (id: string): 'backlog' | 'today' | null => {
    if (id === 'backlog-droppable') return 'backlog';
    if (id === 'today-droppable') return 'today';
    if (displayBacklog.some((t) => t.id === id)) return 'backlog';
    if (displayToday.some((t) => t.id === id)) return 'today';
    return null;
  };

  const handleDragStart = () => {
    setLocalBacklog(backlogTodos);
    setLocalToday(todayTodos);
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
    const sourceList = activeContainer === 'backlog' ? [...displayBacklog] : [...displayToday];
    const destList = overContainer === 'backlog' ? [...displayBacklog] : [...displayToday];

    const activeIndex = sourceList.findIndex((t) => t.id === activeId);
    if (activeIndex === -1) return;

    const movedItem = sourceList[activeIndex]!;
    sourceList.splice(activeIndex, 1);
    const updatedItem = { ...movedItem, isToday: overContainer === 'today' };

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

    const finalBacklog = displayBacklog;
    const finalToday = displayToday;

    if (!over) {
      setLocalBacklog(null);
      setLocalToday(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeContainer = findContainer(activeId);

    // If the item crossed containers (detected via local state vs original),
    // persist the isToday change first. Otherwise the within-column reorder
    // branch below would only send sortOrder and the cross-container move
    // would be lost on refresh.
    const originalTodo = todos.find((t) => t.id === activeId);
    if (originalTodo && activeContainer) {
      const crossedContainers =
        (activeContainer === 'today') !== originalTodo.isToday;
      if (crossedContainers) {
        const targetList = activeContainer === 'today' ? finalToday : finalBacklog;
        const reordered =
          activeId !== overId
            ? (() => {
                const oldIndex = targetList.findIndex((t) => t.id === activeId);
                const newIndex = targetList.findIndex((t) => t.id === overId);
                return oldIndex !== -1 && newIndex !== -1
                  ? arrayMove(targetList, oldIndex, newIndex)
                  : targetList;
              })()
            : targetList;
        const withOrder = reordered.map((t, i) => ({ ...t, sortOrder: i }));
        const otherList = activeContainer === 'today' ? finalBacklog : finalToday;
        queryClient.setQueryData(['todos'], [...otherList, ...withOrder]);
        setLocalBacklog(null);
        setLocalToday(null);

        const movedTodo = withOrder.find((t) => t.id === activeId);
        moveMutation.mutate(
          {
            id: activeId,
            isToday: activeContainer === 'today',
            sortOrder: movedTodo?.sortOrder ?? 0,
          },
          { onError: () => queryClient.invalidateQueries({ queryKey: ['todos'] }) }
        );
        return;
      }
    }

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
        setLocalBacklog(null);
        setLocalToday(null);

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

    setLocalBacklog(null);
    setLocalToday(null);
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
              onReorder={(items, onSettled) =>
                projectReorderMutation.mutate(items, {
                  onSettled,
                  onError: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
                })
              }
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
          }}
          onDragCancel={() => {
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
                  <TodoList
                    droppableId="backlog-droppable"
                    todos={displayBacklog}
                    onToggle={(id, completed) => updateMutation.mutate({ id, completed })}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    onToggleToday={handleToggleToday}
                    onRemoveFromInbox={(id) => pushToInboxMutation.mutate({ id, inInbox: false })}
                    onAssignToProject={(id, projectId) => assignToProjectMutation.mutate({ id, projectId })}
                    projects={projectsData}
                    emptyText="No inbox items"
                    isMobile
                  />
                </>
              )}
              {activeTab === 'today' && (
                <TodoList
                  droppableId="today-droppable"
                  todos={displayToday}
                  onToggle={(id, completed) => updateMutation.mutate({ id, completed })}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onToggleToday={handleToggleToday}
                  projects={projectsData}
                  emptyText="No tasks for today. Switch to Inbox and tap the sun icon to add some!"
                  isMobile
                />
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
                <TodoList
                  droppableId="backlog-droppable"
                  todos={displayBacklog}
                  onToggle={(id, completed) => updateMutation.mutate({ id, completed })}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onRemoveFromInbox={(id) => pushToInboxMutation.mutate({ id, inInbox: false })}
                  onAssignToProject={(id, projectId) => assignToProjectMutation.mutate({ id, projectId })}
                  projects={projectsData}
                  emptyText="No inbox items"
                />
              </div>

              <div className="flex-1 space-y-4">
                <h2 className="text-lg font-semibold text-amber-500">Today</h2>
                <TodoList
                  droppableId="today-droppable"
                  todos={displayToday}
                  onToggle={(id, completed) => updateMutation.mutate({ id, completed })}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  projects={projectsData}
                  emptyText="Drag todos here to focus on them today"
                />
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
