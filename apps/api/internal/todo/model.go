package todo

import "time"

type Todo struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Notes     string    `json:"notes"`
	Priority  string    `json:"priority"`
	DueDate   string    `json:"dueDate"`
	Completed bool      `json:"completed"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type CreateInput struct {
	Title    string `json:"title"`
	Notes    string `json:"notes"`
	Priority string `json:"priority"`
	DueDate  string `json:"dueDate"`
}

type UpdateInput struct {
	Title     *string `json:"title"`
	Notes     *string `json:"notes"`
	Priority  *string `json:"priority"`
	DueDate   *string `json:"dueDate"`
	Completed *bool   `json:"completed"`
}
