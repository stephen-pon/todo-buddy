import type { UUID, ISODateString, Nullable } from './common';

export interface Todo {
  id: UUID;
  title: string;
  completed: boolean;
  dueDate: Nullable<string>;
  isToday: boolean;
  projectId: Nullable<string>;
  inInbox: boolean;
  projectSortOrder: Nullable<number>;
  sortOrder: number;
  userId: UUID;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
