import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, asc, max, sql } from 'drizzle-orm';
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

    const result = await db
      .select({ maxOrder: max(todos.sortOrder) })
      .from(todos)
      .where(eq(todos.userId, currentUser.id));

    const maxOrder = result[0]?.maxOrder ?? null;
    const nextOrder = (maxOrder ?? -1) + 1;

    const [newTodo] = await db
      .insert(todos)
      .values({
        title: data.title,
        dueDate: data.dueDate ?? null,
        sortOrder: nextOrder,
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

    const [updated] = await db
      .update(todos)
      .set(data)
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
    const { items } = c.req.valid('json');
    const currentUser = c.get('user');

    // Validate no duplicate IDs
    const itemIds = items.map((i) => i.id);
    if (new Set(itemIds).size !== itemIds.length)
      return c.json({ error: 'Duplicate IDs in reorder request' }, 400);

    // Validate all IDs belong to the authenticated user
    const owned = await db.query.todos.findMany({
      where: and(
        eq(todos.userId, currentUser.id),
        sql`${todos.id} = ANY(${itemIds})`,
      ),
      columns: { id: true },
    });
    if (owned.length !== itemIds.length)
      return c.json({ error: 'Forbidden' }, 403);

    await db.transaction(async (tx) => {
      for (const item of items) {
        await tx
          .update(todos)
          .set({ sortOrder: item.sortOrder })
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
