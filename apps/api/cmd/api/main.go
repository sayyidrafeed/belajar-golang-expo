package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"todos/api/internal/todo"
)

func main() {
	path := env("TODOS_DB", "data/todos.db")
	store, err := todo.OpenSQLiteStore(path)
	if err != nil {
		slog.Error("open todo storage", "error", err)
		os.Exit(1)
	}
	defer store.Close()
	// One-time import of the pre-SQLite JSON file; skipped once the database has tasks.
	legacy := env("TODOS_FILE", filepath.Join(filepath.Dir(path), "todos.json"))
	if n, err := store.ImportJSON(legacy); err != nil {
		slog.Error("import legacy todos", "error", err)
		os.Exit(1)
	} else if n > 0 {
		slog.Info("imported legacy todos", "count", n, "from", legacy)
	}
	mux := http.NewServeMux()
	todo.NewHandler(todo.NewService(store)).Register(mux)
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})
	origins := strings.Split(env("CORS_ORIGINS", "http://localhost:8081,http://127.0.0.1:8081"), ",")
	server := &http.Server{
		Addr: env("API_ADDR", "0.0.0.0:8080"), Handler: cors(mux, origins),
		ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 15 * time.Second, IdleTimeout: 60 * time.Second,
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdown); err != nil {
			slog.Error("shutdown", "error", err)
		}
	}()
	slog.Info("To-Dos API ready", "address", server.Addr, "storage", path)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		slog.Error("serve", "error", err)
		os.Exit(1)
	}
}

func env(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func cors(next http.Handler, allowed []string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		w.Header().Add("Vary", "Origin")
		for _, candidate := range allowed {
			if origin != "" && origin == strings.TrimSpace(candidate) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
				break
			}
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
