import type { UUID, ISODateString } from './common';

export interface Project {
  id: UUID;
  name: string;
  sortOrder: number;
  userId: UUID;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
