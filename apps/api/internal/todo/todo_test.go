package todo

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func testService(t *testing.T) (*Service, string) {
	t.Helper()
	path := filepath.Join(t.TempDir(), "todos.json")
	store, err := OpenFileStore(path)
	if err != nil {
		t.Fatal(err)
	}
	return NewService(store), path
}

func TestCRUDPersistsAcrossRestart(t *testing.T) {
	s, path := testService(t)
	task, err := s.Create(CreateInput{Title: "  Plan the weekend  ", DueDate: "2026-10-10", Priority: "high"})
	if err != nil {
		t.Fatal(err)
	}
	if task.Title != "Plan the weekend" || task.Completed {
		t.Fatalf("unexpected task: %+v", task)
	}
	complete := true
	notes := "Book a table"
	if _, err := s.Update(task.ID, UpdateInput{Notes: &notes, Completed: &complete}); err != nil {
		t.Fatal(err)
	}
	reopened, err := OpenFileStore(path)
	if err != nil {
		t.Fatal(err)
	}
	s = NewService(reopened)
	actual, err := s.Get(task.ID)
	if err != nil || !actual.Completed || actual.Notes != notes || actual.DueDate != "2026-10-10" {
		t.Fatalf("data did not survive reopen: %+v, %v", actual, err)
	}
	complete = false
	clearDate := ""
	if _, err := s.Update(task.ID, UpdateInput{Completed: &complete, DueDate: &clearDate}); err != nil {
		t.Fatal(err)
	}
	actual, _ = s.Get(task.ID)
	if actual.Completed || actual.DueDate != "" {
		t.Fatal("false and empty date must update, not be omitted")
	}
	if err := s.Delete(task.ID); err != nil {
		t.Fatal(err)
	}
	reopened, err = OpenFileStore(path)
	if err != nil || len(reopened.List()) != 0 {
		t.Fatalf("delete did not persist: %v", err)
	}
}

func TestValidationRejectsInvalidTasks(t *testing.T) {
	s, _ := testService(t)
	for name, input := range map[string]CreateInput{
		"blank":              {Title: " \n "},
		"long unicode title": {Title: strings.Repeat("界", 181)},
		"long notes":         {Title: "Task", Notes: strings.Repeat("a", 4001)},
		"invalid priority":   {Title: "Task", Priority: "urgent"},
		"invalid date":       {Title: "Task", DueDate: "2026-02-30"},
		"date format":        {Title: "Task", DueDate: "2026-2-3"},
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := s.Create(input); err == nil {
				t.Fatal("invalid task accepted")
			}
		})
	}
	if len(s.List()) != 0 {
		t.Fatal("validation failure wrote data")
	}
	task, err := s.Create(CreateInput{Title: "Task", DueDate: "2024-02-29"})
	if err != nil {
		t.Fatal(err)
	}
	empty := ""
	if _, err := s.Update(task.ID, UpdateInput{Title: &empty}); err == nil {
		t.Fatal("invalid edit accepted")
	}
	actual, _ := s.Get(task.ID)
	if actual.Title != "Task" {
		t.Fatal("invalid edit changed existing task")
	}
}

func TestConcurrentPartialUpdatesDoNotLoseFields(t *testing.T) {
	s, _ := testService(t)
	task, err := s.Create(CreateInput{Title: "Task"})
	if err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, err := s.Create(CreateInput{Title: fmt.Sprintf("Concurrent %d", i)})
			if err != nil {
				t.Error(err)
			}
		}(i)
	}
	wg.Add(2)
	go func() {
		defer wg.Done()
		notes := "Concurrent edit"
		if _, err := s.Update(task.ID, UpdateInput{Notes: &notes}); err != nil {
			t.Error(err)
		}
	}()
	go func() {
		defer wg.Done()
		done := true
		if _, err := s.Update(task.ID, UpdateInput{Completed: &done}); err != nil {
			t.Error(err)
		}
	}()
	wg.Wait()
	actual, _ := s.Get(task.ID)
	if !actual.Completed || actual.Notes != "Concurrent edit" || len(s.List()) != 13 {
		t.Fatal("concurrent writes lost data")
	}
}

func TestStorageFailureDoesNotPublishMutation(t *testing.T) {
	s, path := testService(t)
	task, err := s.Create(CreateInput{Title: "Original"})
	if err != nil {
		t.Fatal(err)
	}
	// A directory at the destination makes atomic rename fail on every platform.
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(path, 0700); err != nil {
		t.Fatal(err)
	}
	title := "Unsaved"
	if _, err := s.Update(task.ID, UpdateInput{Title: &title}); err == nil {
		t.Fatal("write unexpectedly succeeded")
	}
	actual, _ := s.Get(task.ID)
	if actual.Title != "Original" {
		t.Fatal("failed write appeared as saved in memory")
	}
}

func TestCorruptFileIsNotOverwritten(t *testing.T) {
	path := filepath.Join(t.TempDir(), "todos.json")
	if err := os.WriteFile(path, []byte("broken"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := OpenFileStore(path); err == nil {
		t.Fatal("corrupt file silently accepted")
	}
	contents, _ := os.ReadFile(path)
	if string(contents) != "broken" {
		t.Fatal("corrupt data was overwritten")
	}
}

func TestHTTPJourneyAndRequestBoundaries(t *testing.T) {
	s, _ := testService(t)
	mux := http.NewServeMux()
	NewHandler(s).Register(mux)
	send := func(method, path, body string, status int) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(method, path, bytes.NewBufferString(body))
		if body != "" {
			r.Header.Set("Content-Type", "application/json")
		}
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		if w.Code != status {
			t.Fatalf("%s %s got %d, want %d: %s", method, path, w.Code, status, w.Body.String())
		}
		return w
	}
	w := send("POST", "/todos", `{"title":"Buy coffee","dueDate":"2026-10-10"}`, 201)
	var task Todo
	if err := json.Unmarshal(w.Body.Bytes(), &task); err != nil {
		t.Fatal(err)
	}
	if w.Header().Get("Location") != "/todos/"+task.ID {
		t.Fatal("missing created resource location")
	}
	send("GET", "/todos/"+task.ID, "", 200)
	send("PATCH", "/todos/"+task.ID, `{"completed":true}`, 200)
	send("PATCH", "/todos/"+task.ID, `{"completed":false}`, 200)
	send("POST", "/todos", `{"title":""}`, 400)
	send("POST", "/todos", `{bad`, 400)
	send("POST", "/todos", `{"title":"Test","unknown":true}`, 400)
	send("POST", "/todos", `{"title":"Test"} {}`, 400)
	send("POST", "/todos", `{"title":"`+strings.Repeat("a", 33<<10)+`"}`, 413)
	send("PATCH", "/todos/"+task.ID, `{}`, 400)
	send("GET", "/todos/missing", "", 404)
	send("DELETE", "/todos/"+task.ID, "", 204)
	send("GET", "/todos/"+task.ID, "", 404)
	w = send("GET", "/todos", "", 200)
	if strings.TrimSpace(w.Body.String()) != `{"todos":[]}` {
		t.Fatal("empty list must be a JSON array")
	}
	r := httptest.NewRequest("POST", "/todos", strings.NewReader(`{"title":"Task"}`))
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, r)
	if w.Code != 415 {
		t.Fatal("missing JSON content type accepted")
	}
}
