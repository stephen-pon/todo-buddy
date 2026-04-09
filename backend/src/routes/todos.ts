import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, asc, min, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { todos } from '../db/schema';
import {
  createTodoSchema,
  updateTodoSchema,
  reorderTodosSchema,
} from '@todo-buddy/shared';
import type { Variables } from '../types/hono';

const todosRoute = new Hono<{ Variables: Variables }>()
  .get('/', async (c) => {
    const currentUser = c.get('user');
    const allTodos = await db.query.todos.findMany({
      where: eq(todos.userId, currentUser.id),
      orderBy: [asc(todos.sortOrder)],
    });
    return c.json(allTodos);
  })
  .post('/', zValidator('json', createTodoSchema), async (c) => {
    const data = c.req.valid('json');
    const currentUser = c.get('user');

    // Compute sortOrder for inbox
    const result = await db
      .select({ minOrder: min(todos.sortOrder) })
      .from(todos)
      .where(eq(todos.userId, currentUser.id));
    const minOrder = result[0]?.minOrder ?? null;
    const newSortOrder = (minOrder ?? 1) - 1;

    let projectSortOrder: number | null = null;
    if (data.projectId) {
      // Compute projectSortOrder (prepend within project)
      const projectResult = await db
        .select({ minOrder: min(todos.projectSortOrder) })
        .from(todos)
        .where(
          and(
            eq(todos.userId, currentUser.id),
            eq(todos.projectId, data.projectId),
          ),
        );
      const minProjectOrder = projectResult[0]?.minOrder ?? null;
      projectSortOrder = (minProjectOrder ?? 1) - 1;
    }

    const [newTodo] = await db
      .insert(todos)
      .values({
        title: data.title,
        dueDate: data.dueDate ?? null,
        sortOrder: newSortOrder,
        projectId: data.projectId ?? null,
        inInbox: data.inInbox ?? !data.projectId, // Default: inbox if no project
        projectSortOrder,
        userId: currentUser.id,
      })
      .returning();
    return c.json(newTodo, 201);
  })
  .put('/:id', zValidator('json', updateTodoSchema), async (c) => {
    const id = c.req.param('id');
    const data = c.req.valid('json');
    const currentUser = c.get('user');

    const existing = await db.query.todos.findFirst({
      where: eq(todos.id, id),
    });
    if (!existing) return c.json({ error: 'Todo not found' }, 404);
    if (existing.userId !== currentUser.id)
      return c.json({ error: 'Forbidden' }, 403);

    // If pushing to inbox for the first time, assign a sortOrder
    const updateData: Record<string, unknown> = { ...data };
    if (data.inInbox === true && !existing.inInbox && existing.projectId) {
      const result = await db
        .select({ minOrder: min(todos.sortOrder) })
        .from(todos)
        .where(eq(todos.userId, currentUser.id));
      const minOrder = result[0]?.minOrder ?? null;
      updateData.sortOrder = (minOrder ?? 1) - 1;
    }

    const [updated] = await db
      .update(todos)
      .set(updateData)
      .where(eq(todos.id, id))
      .returning();
    return c.json(updated);
  })
  .delete('/:id', async (c) => {
    const id = c.req.param('id');
    const currentUser = c.get('user');

    const existing = await db.query.todos.findFirst({
      where: eq(todos.id, id),
    });
    if (!existing) return c.json({ error: 'Todo not found' }, 404);
    if (existing.userId !== currentUser.id)
      return c.json({ error: 'Forbidden' }, 403);

    await db.delete(todos).where(eq(todos.id, id));
    return c.json({ success: true });
  })
  .post('/reorder', zValidator('json', reorderTodosSchema), async (c) => {
    const { context, items } = c.req.valid('json');
    const currentUser = c.get('user');

    const itemIds = items.map((i) => i.id);
    if (new Set(itemIds).size !== itemIds.length)
      return c.json({ error: 'Duplicate IDs in reorder request' }, 400);

    const owned = await db.query.todos.findMany({
      where: and(
        eq(todos.userId, currentUser.id),
        inArray(todos.id, itemIds),
      ),
      columns: { id: true },
    });
    if (owned.length !== itemIds.length)
      return c.json({ error: 'Forbidden' }, 403);

    const sortField = context;

    await db.transaction(async (tx) => {
      for (const item of items) {
        await tx
          .update(todos)
          .set({ [sortField]: item.sortOrder })
          .where(eq(todos.id, item.id));
      }
    });

    return c.json({ success: true });
  })
  .post('/clear-completed', async (c) => {
    const currentUser = c.get('user');

    await db
      .delete(todos)
      .where(
        and(eq(todos.userId, currentUser.id), eq(todos.completed, true)),
      );

    return c.json({ success: true });
  });

export default todosRoute;
