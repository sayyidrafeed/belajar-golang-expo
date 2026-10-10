package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCORSAllowsConfiguredOriginOnly(t *testing.T) {
	h := cors(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) }), []string{"http://localhost:8081"})
	for _, origin := range []string{"http://localhost:8081", "https://other.example"} {
		r := httptest.NewRequest("OPTIONS", "/todos", nil)
		r.Header.Set("Origin", origin)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != 204 {
			t.Fatal("preflight did not succeed")
		}
		actual := w.Header().Get("Access-Control-Allow-Origin")
		if origin == "http://localhost:8081" && actual != origin {
			t.Fatal("configured origin not allowed")
		}
		if origin != "http://localhost:8081" && actual != "" {
			t.Fatal("unexpected origin allowed")
		}
	}
}
