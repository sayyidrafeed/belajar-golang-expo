package todo

import (
	"crypto/rand"
	"encoding/hex"
	"strings"
	"time"
	"unicode/utf8"
)

type ValidationError struct{ Message string }

func (e *ValidationError) Error() string { return e.Message }

type Service struct{ store *FileStore }

func NewService(store *FileStore) *Service     { return &Service{store: store} }
func (s *Service) List() []Todo                { return s.store.List() }
func (s *Service) Get(id string) (Todo, error) { return s.store.Get(id) }
func (s *Service) Delete(id string) error      { return s.store.Delete(id) }

func (s *Service) Create(input CreateInput) (Todo, error) {
	if input.Priority == "" {
		input.Priority = "normal"
	}
	now := time.Now().UTC()
	t := Todo{Title: input.Title, Notes: input.Notes, Priority: input.Priority, DueDate: input.DueDate, CreatedAt: now, UpdatedAt: now}
	if err := validate(&t); err != nil {
		return Todo{}, err
	}
	var id [16]byte
	if _, err := rand.Read(id[:]); err != nil {
		return Todo{}, err
	}
	t.ID = hex.EncodeToString(id[:])
	if err := s.store.Create(t); err != nil {
		return Todo{}, err
	}
	return t, nil
}

func (s *Service) Update(id string, input UpdateInput) (Todo, error) {
	if input.Title == nil && input.Notes == nil && input.Priority == nil && input.DueDate == nil && input.Completed == nil {
		return Todo{}, &ValidationError{"Provide at least one field to update."}
	}
	return s.store.Update(id, func(t *Todo) error {
		if input.Title != nil {
			t.Title = *input.Title
		}
		if input.Notes != nil {
			t.Notes = *input.Notes
		}
		if input.Priority != nil {
			t.Priority = *input.Priority
		}
		if input.DueDate != nil {
			t.DueDate = *input.DueDate
		}
		if input.Completed != nil {
			t.Completed = *input.Completed
		}
		if err := validate(t); err != nil {
			return err
		}
		t.UpdatedAt = time.Now().UTC()
		return nil
	})
}

func validate(t *Todo) error {
	t.Title = strings.TrimSpace(t.Title)
	t.Notes = strings.TrimSpace(t.Notes)
	if t.Title == "" {
		return &ValidationError{"Give your task a title."}
	}
	if utf8.RuneCountInString(t.Title) > 180 {
		return &ValidationError{"Keep the title within 180 characters."}
	}
	if utf8.RuneCountInString(t.Notes) > 4000 {
		return &ValidationError{"Keep notes within 4,000 characters."}
	}
	if t.Priority != "low" && t.Priority != "normal" && t.Priority != "high" {
		return &ValidationError{"Choose low, normal, or high priority."}
	}
	if t.DueDate != "" {
		date, err := time.Parse("2006-01-02", t.DueDate)
		if err != nil || date.Format("2006-01-02") != t.DueDate {
			return &ValidationError{"Use a valid due date in YYYY-MM-DD format."}
		}
	}
	return nil
}
