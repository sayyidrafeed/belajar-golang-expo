import { request } from '../../lib/api';
import type { Todo, TodoDraft, TodoUpdate } from './types';

export const todoAPI = {
  list: () => request<{ todos: Todo[] }>('/todos'),
  create: (draft: TodoDraft) => request<Todo>('/todos', { method: 'POST', body: JSON.stringify(draft) }),
  update: (id: string, input: TodoUpdate) => request<Todo>(`/todos/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  delete: (id: string) => request<void>(`/todos/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
