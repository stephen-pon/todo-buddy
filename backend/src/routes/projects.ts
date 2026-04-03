import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, asc, min } from 'drizzle-orm';
import { db } from '../db/client';
import { projects, todos } from '../db/schema';
import { createProjectSchema, updateProjectSchema } from '@todo-buddy/shared';
import type { Variables } from '../types/hono';

const projectsRoute = new Hono<{ Variables: Variables }>()
  .get('/', async (c) => {
    const currentUser = c.get('user');
    const allProjects = await db.query.projects.findMany({
      where: eq(projects.userId, currentUser.id),
      orderBy: [asc(projects.sortOrder)],
      with: {
        todos: {
          orderBy: [asc(todos.projectSortOrder)],
        },
      },
    });
    return c.json(allProjects);
  })
  .post('/', zValidator('json', createProjectSchema), async (c) => {
    const data = c.req.valid('json');
    const currentUser = c.get('user');

    const result = await db
      .select({ minOrder: min(projects.sortOrder) })
      .from(projects)
      .where(eq(projects.userId, currentUser.id));

    const minOrder = result[0]?.minOrder ?? null;
    const newOrder = (minOrder ?? 1) - 1;

    const [newProject] = await db
      .insert(projects)
      .values({
        name: data.name,
        sortOrder: newOrder,
        userId: currentUser.id,
      })
      .returning();
    return c.json(newProject, 201);
  })
  .put('/:id', zValidator('json', updateProjectSchema), async (c) => {
    const id = c.req.param('id');
    const data = c.req.valid('json');
    const currentUser = c.get('user');

    const existing = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });
    if (!existing) return c.json({ error: 'Project not found' }, 404);
    if (existing.userId !== currentUser.id)
      return c.json({ error: 'Forbidden' }, 403);

    const [updated] = await db
      .update(projects)
      .set(data)
      .where(eq(projects.id, id))
      .returning();
    return c.json(updated);
  })
  .delete('/:id', async (c) => {
    const id = c.req.param('id');
    const currentUser = c.get('user');

    const existing = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });
    if (!existing) return c.json({ error: 'Project not found' }, 404);
    if (existing.userId !== currentUser.id)
      return c.json({ error: 'Forbidden' }, 403);

    await db.delete(projects).where(eq(projects.id, id));
    return c.json({ success: true });
  });

export default projectsRoute;
