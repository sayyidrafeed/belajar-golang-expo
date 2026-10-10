package todo

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
)

var ErrNotFound = errors.New("todo not found")

type FileStore struct {
	mu   sync.RWMutex
	path string
	data map[string]Todo
}

func OpenFileStore(path string) (*FileStore, error) {
	s := &FileStore{path: path, data: make(map[string]Todo)}
	contents, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		if err := s.persist(s.data); err != nil {
			return nil, err
		}
		return s, nil
	}
	if err != nil {
		return nil, err
	}
	var tasks []Todo
	if err := json.Unmarshal(contents, &tasks); err != nil {
		return nil, fmt.Errorf("read todo data: %w", err)
	}
	for _, t := range tasks {
		s.data[t.ID] = t
	}
	return s, nil
}

func (s *FileStore) List() []Todo {
	s.mu.RLock()
	defer s.mu.RUnlock()
	items := make([]Todo, 0, len(s.data))
	for _, t := range s.data {
		items = append(items, t)
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].CreatedAt.Equal(items[j].CreatedAt) {
			return items[i].ID < items[j].ID
		}
		return items[i].CreatedAt.Before(items[j].CreatedAt)
	})
	return items
}

func (s *FileStore) Get(id string) (Todo, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	t, ok := s.data[id]
	if !ok {
		return Todo{}, ErrNotFound
	}
	return t, nil
}

func (s *FileStore) Create(t Todo) error {
	return s.change(func(data map[string]Todo) error { data[t.ID] = t; return nil })
}

func (s *FileStore) Update(id string, apply func(*Todo) error) (Todo, error) {
	var updated Todo
	err := s.change(func(data map[string]Todo) error {
		t, ok := data[id]
		if !ok {
			return ErrNotFound
		}
		if err := apply(&t); err != nil {
			return err
		}
		data[id] = t
		updated = t
		return nil
	})
	return updated, err
}

func (s *FileStore) Delete(id string) error {
	return s.change(func(data map[string]Todo) error {
		if _, ok := data[id]; !ok {
			return ErrNotFound
		}
		delete(data, id)
		return nil
	})
}

func (s *FileStore) change(apply func(map[string]Todo) error) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	next := make(map[string]Todo, len(s.data))
	for id, t := range s.data {
		next[id] = t
	}
	if err := apply(next); err != nil {
		return err
	}
	// Publish the new state only after the durable write succeeds.
	if err := s.persist(next); err != nil {
		return err
	}
	s.data = next
	return nil
}

func (s *FileStore) persist(data map[string]Todo) error {
	if err := os.MkdirAll(filepath.Dir(s.path), 0700); err != nil {
		return err
	}
	items := make([]Todo, 0, len(data))
	for _, t := range data {
		items = append(items, t)
	}
	contents, err := json.MarshalIndent(items, "", "  ")
	if err != nil {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(s.path), ".todos-*")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	if _, err = f.Write(contents); err != nil {
		f.Close()
		return err
	}
	if err = f.Sync(); err != nil {
		f.Close()
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	return os.Rename(f.Name(), s.path)
}
