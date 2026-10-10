export type Priority = 'low' | 'normal' | 'high';

export type Todo = {
  id: string;
  title: string;
  notes: string;
  priority: Priority;
  dueDate: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TodoDraft = Pick<Todo, 'title' | 'notes' | 'priority' | 'dueDate'>;
export type TodoUpdate = Partial<TodoDraft & Pick<Todo, 'completed'>>;
export type ViewFilter = 'all' | 'today' | 'upcoming' | 'important' | 'completed';
export type SortOrder = 'smart' | 'newest' | 'title';
