package services

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"time"
)

// BuildAuthenticatedGitURL prepares the clone URL for both public and private token authentication
func BuildAuthenticatedGitURL(repoURL string, gitToken ...string) (string, string) {
	cloneURL := strings.TrimSpace(repoURL)
	token := ""
	if len(gitToken) > 0 && strings.TrimSpace(gitToken[0]) != "" {
		token = strings.TrimSpace(gitToken[0])
		if strings.HasPrefix(cloneURL, "https://") {
			cloneURL = strings.Replace(cloneURL, "https://", fmt.Sprintf("https://oauth2:%s@", token), 1)
		} else if strings.HasPrefix(cloneURL, "http://") {
			cloneURL = strings.Replace(cloneURL, "http://", fmt.Sprintf("http://oauth2:%s@", token), 1)
		}
	}
	return cloneURL, token
}

// TranslateGitError formats raw git CLI errors into concise, user-friendly English messages
func TranslateGitError(rawError string, repoURL string, token string) error {
	cleanMsg := rawError
	if token != "" {
		cleanMsg = strings.ReplaceAll(cleanMsg, token, "******")
	}

	// Remove temporary directory path artifacts like "Cloning into '/var/folders/.../deploy-...'"
	reCloning := regexp.MustCompile(`(?i)cloning into '[^']+'\.{3}\s*`)
	cleanMsg = reCloning.ReplaceAllString(cleanMsg, "")
	cleanMsg = strings.TrimSpace(cleanMsg)

	lower := strings.ToLower(cleanMsg)

	// 1. Repository not found (404 / Typo / Deleted)
	if strings.Contains(lower, "not found") || strings.Contains(lower, "repository not found") || strings.Contains(lower, "does not exist") {
		return fmt.Errorf("❌ Git repository not found: Please verify the URL or provide a Personal Access Token in Advanced Settings for private repositories")
	}

	// 2. Authentication / Permission errors
	if strings.Contains(lower, "authentication failed") ||
		strings.Contains(lower, "could not read username") ||
		strings.Contains(lower, "permission denied") ||
		strings.Contains(lower, "terminal prompts disabled") {
		return fmt.Errorf("🔒 Access denied: Please verify repository permissions or provide a valid Personal Access Token in Advanced Settings")
	}

	// 3. Network / DNS / Host
	if strings.Contains(lower, "could not resolve host") ||
		strings.Contains(lower, "connection timed out") ||
		strings.Contains(lower, "failed to connect") ||
		strings.Contains(lower, "network is unreachable") {
		return fmt.Errorf("🌐 Network connection error: Unable to connect to Git server. Please check internet connection or host URL")
	}

	// Fallback
	if cleanMsg == "" {
		cleanMsg = "Unknown error occurred while fetching code from Git"
	}
	return fmt.Errorf("Git clone failed: %s", cleanMsg)
}

// ValidateGitRepository performs a fast pre-flight check on repository access
func ValidateGitRepository(repoURL string, gitToken ...string) error {
	cleanRepoURL := strings.TrimSpace(repoURL)
	if cleanRepoURL == "" {
		return fmt.Errorf("Repository URL is required")
	}

	authURL, token := BuildAuthenticatedGitURL(cleanRepoURL, gitToken...)

	// Timeout within 8 seconds to prevent hanging
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "git", "ls-remote", "--heads", authURL)
	cmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0")

	output, err := cmd.CombinedOutput()
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("⏳ Git connection timeout: Please verify repository URL or network")
		}
		return TranslateGitError(string(output), cleanRepoURL, token)
	}

	return nil
}

// GetRepoBranches fetches all remote branches using git ls-remote without cloning.
func GetRepoBranches(repoURL string, gitToken ...string) ([]string, string, error) {
	cleanRepoURL := strings.TrimSpace(repoURL)
	if cleanRepoURL == "" {
		return []string{"main"}, "main", fmt.Errorf("empty repo url")
	}

	authURL, _ := BuildAuthenticatedGitURL(cleanRepoURL, gitToken...)

	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "git", "ls-remote", "--heads", authURL)
	cmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0")

	output, err := cmd.CombinedOutput()
	if err != nil {
		return []string{"main"}, "main", nil
	}

	lines := strings.Split(string(output), "\n")
	var branches []string
	defaultBranch := "main"

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.Split(line, "refs/heads/")
		if len(parts) == 2 {
			branch := strings.TrimSpace(parts[1])
			if branch != "" {
				branches = append(branches, branch)
			}
		}
	}

	if len(branches) == 0 {
		branches = []string{"main"}
	}

	hasMain := false
	hasMaster := false
	for _, b := range branches {
		if b == "main" {
			hasMain = true
		}
		if b == "master" {
			hasMaster = true
		}
	}
	if hasMain {
		defaultBranch = "main"
	} else if hasMaster {
		defaultBranch = "master"
	} else {
		defaultBranch = branches[0]
	}

	return branches, defaultBranch, nil
}

// CloneRepository clones the git repository after performing pre-flight validation
func CloneRepository(repoURL string, branch string, gitToken ...string) (string, error) {
	cleanRepoURL := strings.TrimSpace(repoURL)

	// Step 1: Pre-flight check
	if err := ValidateGitRepository(cleanRepoURL, gitToken...); err != nil {
		return "", err
	}

	// Step 2: Temporary build directory
	buildDir, err := os.MkdirTemp("", "deploy-*")
	if err != nil {
		return "", fmt.Errorf("failed to create temporary workspace: %w", err)
	}

	authURL, token := BuildAuthenticatedGitURL(cleanRepoURL, gitToken...)

	fmt.Println("📂 Created workspace at:", buildDir)
	fmt.Printf("⬇️ Fetching source code from: %s (Branch: %s)\n", cleanRepoURL, branch)

	args := []string{"clone"}
	if strings.TrimSpace(branch) != "" {
		args = append(args, "--branch", strings.TrimSpace(branch), "--single-branch")
	}
	args = append(args, authURL, buildDir)

	cmd := exec.Command("git", args...)
	cmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0")

	if output, err := cmd.CombinedOutput(); err != nil {
		os.RemoveAll(buildDir)
		return "", TranslateGitError(string(output), cleanRepoURL, token)
	}

	return buildDir, nil
}

// GitMetadata represents Git branch, commit hash, commit message, and author details.
type GitMetadata struct {
	Branch        string
	CommitHash    string
	CommitMessage string
	AuthorName    string
	AuthorAvatar  string
}

// GetGitMetadata retrieves branch, commit, message, and author from the local Git repository directory.
func GetGitMetadata(repoDir string, originalRepoURL string) GitMetadata {
	meta := GitMetadata{
		Branch:     "main",
		CommitHash: "head",
	}

	// 1. Resolve current branch name (e.g. main, master, dev)
	branchCmd := exec.Command("git", "rev-parse", "--abbrev-ref", "HEAD")
	branchCmd.Dir = repoDir
	if out, err := branchCmd.Output(); err == nil {
		b := strings.TrimSpace(string(out))
		if b != "" && b != "HEAD" {
			meta.Branch = b
		}
	}

	// 2. Fetch short commit hash, author name, and commit subject
	logCmd := exec.Command("git", "log", "-1", "--pretty=format:%h|%an|%s")
	logCmd.Dir = repoDir
	if out, err := logCmd.Output(); err == nil {
		parts := strings.SplitN(strings.TrimSpace(string(out)), "|", 3)
		if len(parts) >= 1 && strings.TrimSpace(parts[0]) != "" {
			meta.CommitHash = strings.TrimSpace(parts[0])
		}
		if len(parts) >= 2 && strings.TrimSpace(parts[1]) != "" {
			meta.AuthorName = strings.TrimSpace(parts[1])
		}
		if len(parts) >= 3 && strings.TrimSpace(parts[2]) != "" {
			meta.CommitMessage = strings.TrimSpace(parts[2])
		}
	}

	// 3. Resolve avatar from GitHub repository owner if applicable
	cleanURL := strings.TrimSpace(originalRepoURL)
	if strings.Contains(cleanURL, "github.com/") {
		trimmed := strings.Split(cleanURL, "github.com/")[1]
		parts := strings.Split(trimmed, "/")
		if len(parts) >= 1 && parts[0] != "" {
			owner := strings.TrimSpace(parts[0])
			meta.AuthorAvatar = fmt.Sprintf("https://github.com/%s.png?size=64", owner)
			if meta.AuthorName == "" {
				meta.AuthorName = owner
			}
		}
	}

	if meta.AuthorName == "" {
		meta.AuthorName = "Developer"
	}

	return meta
}
