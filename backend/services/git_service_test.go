package services

import (
	"testing"
)

func TestValidateGitRepository(t *testing.T) {
	// 1. Repo ที่ไม่มีอยู่จริง (ต้องคืน error ภาษาไทยที่ชัดเจน)
	err := ValidateGitRepository("https://github.com/melvincwng/react-todo-app")
	if err == nil {
		t.Fatalf("Expected error for non-existent repo, got nil")
	}
	t.Logf("✅ Error message for 404 repo: %v", err)

	// 2. Repo ที่มีอยู่จริง (ต้องคืน nil ทันที)
	errValid := ValidateGitRepository("https://github.com/gothinkster/golang-gin-realworld-example-app")
	if errValid != nil {
		t.Fatalf("Expected valid repo to succeed, got error: %v", errValid)
	}
	t.Logf("✅ Valid repo passed pre-flight check successfully!")
}
