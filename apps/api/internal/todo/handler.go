package todo

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime"
	"net/http"
)

type Handler struct{ service *Service }

func NewHandler(service *Service) *Handler { return &Handler{service: service} }

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /todos", h.list)
	mux.HandleFunc("POST /todos", h.create)
	mux.HandleFunc("GET /todos/{id}", h.get)
	mux.HandleFunc("PATCH /todos/{id}", h.update)
	mux.HandleFunc("DELETE /todos/{id}", h.delete)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	todos, err := h.service.List()
	if err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"todos": todos})
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	t, err := h.service.Get(r.PathValue("id"))
	if err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, t)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var input CreateInput
	if !decode(w, r, &input) {
		return
	}
	t, err := h.service.Create(input)
	if err != nil {
		fail(w, err)
		return
	}
	w.Header().Set("Location", "/todos/"+t.ID)
	writeJSON(w, http.StatusCreated, t)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	var input UpdateInput
	if !decode(w, r, &input) {
		return
	}
	t, err := h.service.Update(r.PathValue("id"), input)
	if err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, t)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	if err := h.service.Delete(r.PathValue("id")); err != nil {
		fail(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func decode(w http.ResponseWriter, r *http.Request, dst any) bool {
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" {
		apiError(w, http.StatusUnsupportedMediaType, "unsupported_media_type", "Send the request as application/json.")
		return false
	}
	r.Body = http.MaxBytesReader(w, r.Body, 32<<10)
	defer r.Body.Close()
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(dst); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			apiError(w, http.StatusRequestEntityTooLarge, "body_too_large", "Request body is too large.")
		} else {
			apiError(w, http.StatusBadRequest, "invalid_json", "Send a valid JSON object with supported fields.")
		}
		return false
	}
	if err := d.Decode(&struct{}{}); err != io.EOF {
		apiError(w, http.StatusBadRequest, "invalid_json", "Send exactly one JSON object.")
		return false
	}
	return true
}

func fail(w http.ResponseWriter, err error) {
	var validation *ValidationError
	switch {
	case errors.Is(err, ErrNotFound):
		apiError(w, http.StatusNotFound, "not_found", "This task no longer exists. Refresh your list.")
	case errors.As(err, &validation):
		apiError(w, http.StatusBadRequest, "validation", validation.Message)
	default:
		slog.Error("todo operation failed", "error", err)
		apiError(w, http.StatusInternalServerError, "storage_error", "Could not save your task. Try again.")
	}
}

func apiError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{"error": map[string]string{"code": code, "message": message}})
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		slog.Error("write response", "error", err)
	}
}
