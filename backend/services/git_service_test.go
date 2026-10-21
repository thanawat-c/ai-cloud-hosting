package services

import (
	"testing"
)

func TestValidateGitRepository(t *testing.T) {
	// 1. Non-existent repository (must return translated user-friendly error)
	err := ValidateGitRepository("https://github.com/melvincwng/react-todo-app")
	if err == nil {
		t.Fatalf("Expected error for non-existent repo, got nil")
	}
	t.Logf("✅ Error message for 404 repo: %v", err)

	// 2. Valid repository (must return nil immediately)
	errValid := ValidateGitRepository("https://github.com/gothinkster/golang-gin-realworld-example-app")
	if errValid != nil {
		t.Fatalf("Expected valid repo to succeed, got error: %v", errValid)
	}
	t.Logf("✅ Valid repo passed pre-flight check successfully!")
}
