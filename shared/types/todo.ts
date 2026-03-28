import type { UUID, ISODateString, Nullable } from './common';

export interface Todo {
  id: UUID;
  title: string;
  completed: boolean;
  dueDate: Nullable<string>;
  sortOrder: number;
  userId: UUID;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
