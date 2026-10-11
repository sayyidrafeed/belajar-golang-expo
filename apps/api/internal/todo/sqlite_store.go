package todo

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

var ErrNotFound = errors.New("todo not found")

const schema = `
CREATE TABLE IF NOT EXISTS todos (
	id         TEXT PRIMARY KEY,
	title      TEXT NOT NULL,
	notes      TEXT NOT NULL,
	priority   TEXT NOT NULL,
	due_date   TEXT NOT NULL,
	completed  INTEGER NOT NULL,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
)`

const columns = "id, title, notes, priority, due_date, completed, created_at, updated_at"

// SQLiteStore keeps tasks in one SQLite file. It uses a single connection, so
// writes are serialized and a failed write never changes visible state.
type SQLiteStore struct{ db *sql.DB }

func OpenSQLiteStore(path string) (*SQLiteStore, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return nil, err
	}
	q := url.Values{}
	q.Add("_pragma", "journal_mode(WAL)")
	q.Add("_pragma", "busy_timeout(5000)")
	q.Add("_pragma", "synchronous(NORMAL)")
	db, err := sql.Open("sqlite", (&url.URL{Scheme: "file", Opaque: path, RawQuery: q.Encode()}).String())
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, fmt.Errorf("open todo database: %w", err)
	}
	return &SQLiteStore{db: db}, nil
}

func (s *SQLiteStore) Close() error { return s.db.Close() }

// ImportJSON copies tasks from the legacy todos.json file. It does nothing
// when the file is absent or the database already holds tasks.
func (s *SQLiteStore) ImportJSON(path string) (int, error) {
	contents, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	var tasks []Todo
	if err := json.Unmarshal(contents, &tasks); err != nil {
		return 0, fmt.Errorf("read legacy todo data: %w", err)
	}
	tx, err := s.db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	var existing int
	if err := tx.QueryRow("SELECT COUNT(*) FROM todos").Scan(&existing); err != nil {
		return 0, err
	}
	if existing > 0 {
		return 0, nil
	}
	for _, t := range tasks {
		if err := insert(tx, t); err != nil {
			return 0, err
		}
	}
	return len(tasks), tx.Commit()
}

type scanner interface{ Scan(...any) error }

func scan(r scanner) (Todo, error) {
	var t Todo
	var completed, created, updated int64
	if err := r.Scan(&t.ID, &t.Title, &t.Notes, &t.Priority, &t.DueDate, &completed, &created, &updated); err != nil {
		return Todo{}, err
	}
	t.Completed = completed != 0
	t.CreatedAt = time.Unix(0, created).UTC()
	t.UpdatedAt = time.Unix(0, updated).UTC()
	return t, nil
}

type execer interface {
	Exec(string, ...any) (sql.Result, error)
}

func insert(e execer, t Todo) error {
	_, err := e.Exec("INSERT INTO todos ("+columns+") VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		t.ID, t.Title, t.Notes, t.Priority, t.DueDate, t.Completed, t.CreatedAt.UnixNano(), t.UpdatedAt.UnixNano())
	return err
}

func (s *SQLiteStore) List() ([]Todo, error) {
	rows, err := s.db.Query("SELECT " + columns + " FROM todos ORDER BY created_at, id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []Todo{}
	for rows.Next() {
		t, err := scan(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, t)
	}
	return items, rows.Err()
}

func (s *SQLiteStore) Get(id string) (Todo, error) {
	t, err := scan(s.db.QueryRow("SELECT "+columns+" FROM todos WHERE id = ?", id))
	if errors.Is(err, sql.ErrNoRows) {
		return Todo{}, ErrNotFound
	}
	return t, err
}

func (s *SQLiteStore) Create(t Todo) error { return insert(s.db, t) }

func (s *SQLiteStore) Update(id string, apply func(*Todo) error) (Todo, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return Todo{}, err
	}
	defer tx.Rollback()
	t, err := scan(tx.QueryRow("SELECT "+columns+" FROM todos WHERE id = ?", id))
	if errors.Is(err, sql.ErrNoRows) {
		return Todo{}, ErrNotFound
	}
	if err != nil {
		return Todo{}, err
	}
	if err := apply(&t); err != nil {
		return Todo{}, err
	}
	_, err = tx.Exec("UPDATE todos SET title = ?, notes = ?, priority = ?, due_date = ?, completed = ?, updated_at = ? WHERE id = ?",
		t.Title, t.Notes, t.Priority, t.DueDate, t.Completed, t.UpdatedAt.UnixNano(), id)
	if err != nil {
		return Todo{}, err
	}
	return t, tx.Commit()
}

func (s *SQLiteStore) Delete(id string) error {
	res, err := s.db.Exec("DELETE FROM todos WHERE id = ?", id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}
