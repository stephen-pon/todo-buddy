import { z } from 'zod';

export const createTodoSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  dueDate: z.string().date().optional(),
});

export const updateTodoSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255).optional(),
  completed: z.boolean().optional(),
  dueDate: z.string().date().nullable().optional(),
  isToday: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const reorderTodosSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        sortOrder: z.number().int(),
      }),
    )
    .min(1),
});

export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
export type ReorderTodosInput = z.infer<typeof reorderTodosSchema>;
