import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { todoAPI } from './api';
import type { Todo, TodoDraft, TodoUpdate } from './types';

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const mutating = useRef(false);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    if (mutating.current) return;
    const current = ++generation.current;
    setLoading(true);
    try {
      const data = await todoAPI.list();
      if (alive.current && current === generation.current) {
        setTodos(data.todos);
        setError('');
        setLoaded(true);
      }
    } catch (error) {
      if (alive.current && current === generation.current) setError(message(error));
    } finally {
      if (alive.current && current === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    const onFocus = () => void refresh();
    if (Platform.OS === 'web') window.addEventListener('focus', onFocus);
    return () => {
      alive.current = false;
      ++generation.current;
      subscription.remove();
      if (Platform.OS === 'web') window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  async function mutate(operation: () => Promise<void>) {
    if (mutating.current) return false;
    mutating.current = true;
    ++generation.current;
    setLoading(false);
    setBusy(true);
    setError('');
    try {
      await operation();
      return true;
    } catch (error) {
      if (alive.current) setError(message(error));
      return false;
    } finally {
      mutating.current = false;
      if (alive.current) setBusy(false);
    }
  }

  return {
    todos, loading, loaded, busy, error, refresh, clearError: () => setError(''),
    create: (draft: TodoDraft) => mutate(async () => {
      const task = await todoAPI.create(draft);
      if (alive.current) setTodos((items) => [...items, task]);
    }),
    update: (id: string, input: TodoUpdate) => mutate(async () => {
      const task = await todoAPI.update(id, input);
      if (alive.current) setTodos((items) => items.map((item) => item.id === id ? task : item));
    }),
    remove: (id: string) => mutate(async () => {
      await todoAPI.delete(id);
      if (alive.current) setTodos((items) => items.filter((item) => item.id !== id));
    }),
  };
}

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
