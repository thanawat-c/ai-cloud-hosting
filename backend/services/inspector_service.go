package services

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

type InspectResult struct {
	DetectedEnvs      []string `json:"detected_envs"`
	EnvTemplate       string   `json:"env_template"`
	HasDatabase       bool     `json:"has_database"`
	DBVarNames        []string `json:"db_var_names"`
	DetectedFramework string   `json:"detected_framework"`
	IsMonorepo        bool     `json:"is_monorepo"`
	Branches          []string `json:"branches"`
	DefaultBranch     string   `json:"default_branch"`
}

// InspectRepository โคลน repo แบบตื้น (--depth 1) มาสแกนหาตัวแปรและโครงสร้างโค้ด
func InspectRepository(repoURL string, gitToken ...string) (*InspectResult, error) {
	cleanRepoURL := strings.TrimSpace(repoURL)
	if err := ValidateGitRepository(cleanRepoURL, gitToken...); err != nil {
		return nil, err
	}

	// ดึง Branches แบบรวดเร็ว
	branches, defBranch, _ := GetRepoBranches(cleanRepoURL, gitToken...)

	tempDir, err := os.MkdirTemp("", "inspect-*")
	if err != nil {
		return nil, fmt.Errorf("failed to create temporary workspace: %w", err)
	}
	defer os.RemoveAll(tempDir)

	authURL, token := BuildAuthenticatedGitURL(cleanRepoURL, gitToken...)

	// ใช้ --depth 1 เพื่อความรวดเร็วระดับวินาที
	cmd := exec.Command("git", "clone", "--depth", "1", authURL, tempDir)
	cmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0")
	if output, err := cmd.CombinedOutput(); err != nil {
		return nil, TranslateGitError(string(output), cleanRepoURL, token)
	}

	result := &InspectResult{
		DetectedEnvs:  []string{},
		DBVarNames:    []string{},
		Branches:      branches,
		DefaultBranch: defBranch,
	}

	envMap := make(map[string]string)

	// 1. ตรวจหาไฟล์ .env.example หรือไฟล์ template ทั้งหมดในโปรเจกต์ (รวมถึงโฟลเดอร์ client/ และ server/ ใน Monorepo)
	sampleFiles := []string{
		".env.example", ".env.sample", ".env.template", ".env.local.example",
		"example.env", "sample.env", "env.example",
	}

	_ = filepath.Walk(tempDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			name := info.Name()
			if name == ".git" || name == "node_modules" || name == "vendor" || name == ".next" {
				return filepath.SkipDir
			}
			return nil
		}

		baseName := strings.ToLower(info.Name())
		isSample := false
		for _, s := range sampleFiles {
			if baseName == s || strings.HasPrefix(baseName, ".env.") {
				isSample = true
				break
			}
		}

		if isSample {
			if file, err := os.Open(path); err == nil {
				scanner := bufio.NewScanner(file)
				for scanner.Scan() {
					line := strings.TrimSpace(scanner.Text())
					if line == "" || strings.HasPrefix(line, "#") {
						continue
					}
					parts := strings.SplitN(line, "=", 2)
					key := strings.TrimSpace(parts[0])
					val := ""
					if len(parts) > 1 {
						val = strings.TrimSpace(parts[1])
					}
					if isValidEnvKey(key) {
						if _, exists := envMap[key]; !exists {
							envMap[key] = val
						}
					}
				}
				file.Close()
			}
		}
		return nil
	})

	// 2. Regex สแกนหาการเรียกใช้ env ในไฟล์โค้ด (.go, .js, .ts, .jsx, .tsx, .vue, .py, .prisma)
	reGo := regexp.MustCompile(`(?:os\.Getenv|os\.LookupEnv)\(["']([A-Za-z0-9_]+)["']\)`)
	reNode := regexp.MustCompile(`process\.env\.([A-Za-z0-9_]+)`)
	reVite := regexp.MustCompile(`import\.meta\.env\.([A-Za-z0-9_]+)`)
	reNuxt := regexp.MustCompile(`(?:process\.env\.|env\.)?(NUXT_PUBLIC_[A-Za-z0-9_]+)`)
	rePy := regexp.MustCompile(`(?:os\.environ(?:\.get)?|os\.getenv)\(["']([A-Za-z0-9_]+)["']\)`)
	rePrisma := regexp.MustCompile(`env\(["']([A-Za-z0-9_]+)["']\)`)

	_ = filepath.Walk(tempDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			name := info.Name()
			if name == ".git" || name == "node_modules" || name == "vendor" || name == ".next" {
				return filepath.SkipDir
			}
			return nil
		}

		ext := strings.ToLower(filepath.Ext(path))
		if ext != ".go" && ext != ".js" && ext != ".ts" && ext != ".jsx" && ext != ".tsx" && ext != ".vue" && ext != ".py" && ext != ".prisma" {
			return nil
		}

		// อ่านเฉพาะไฟล์ขนาดไม่เกิน 500 KB เพื่อประสิทธิภาพ
		if info.Size() > 500*1024 {
			return nil
		}

		contentBytes, err := os.ReadFile(path)
		if err != nil {
			return nil
		}
		content := string(contentBytes)

		for _, m := range reGo.FindAllStringSubmatch(content, -1) {
			if len(m) > 1 && isValidEnvKey(m[1]) {
				if _, ok := envMap[m[1]]; !ok {
					envMap[m[1]] = ""
				}
			}
		}
		for _, m := range reNode.FindAllStringSubmatch(content, -1) {
			if len(m) > 1 && isValidEnvKey(m[1]) {
				if _, ok := envMap[m[1]]; !ok {
					envMap[m[1]] = ""
				}
			}
		}
		for _, m := range reVite.FindAllStringSubmatch(content, -1) {
			if len(m) > 1 && isValidEnvKey(m[1]) {
				if _, ok := envMap[m[1]]; !ok {
					envMap[m[1]] = ""
				}
			}
		}
		for _, m := range reNuxt.FindAllStringSubmatch(content, -1) {
			if len(m) > 1 && isValidEnvKey(m[1]) {
				if _, ok := envMap[m[1]]; !ok {
					envMap[m[1]] = ""
				}
			}
		}
		for _, m := range rePy.FindAllStringSubmatch(content, -1) {
			if len(m) > 1 && isValidEnvKey(m[1]) {
				if _, ok := envMap[m[1]]; !ok {
					envMap[m[1]] = ""
				}
			}
		}
		for _, m := range rePrisma.FindAllStringSubmatch(content, -1) {
			if len(m) > 1 && isValidEnvKey(m[1]) {
				if _, ok := envMap[m[1]]; !ok {
					envMap[m[1]] = ""
				}
			}
		}

		return nil
	})

	// 3. ตรวจจับ Framework
	result.DetectedFramework = detectFramework(tempDir)

	// 4. สรุปตัวแปร และตรวจจับตัวแปร Database
	var templateLines []string
	for k, v := range envMap {
		result.DetectedEnvs = append(result.DetectedEnvs, k)
		upper := strings.ToUpper(k)
		if strings.Contains(upper, "DB") || strings.Contains(upper, "DATABASE") || strings.Contains(upper, "POSTGRES") || strings.Contains(upper, "MONGO") {
			result.HasDatabase = true
			result.DBVarNames = append(result.DBVarNames, k)
		}
		if v != "" {
			templateLines = append(templateLines, fmt.Sprintf("%s=%s", k, v))
		} else {
			templateLines = append(templateLines, fmt.Sprintf("%s=", k))
		}
	}

	result.EnvTemplate = strings.Join(templateLines, "\n")
	return result, nil
}

func isValidEnvKey(key string) bool {
	if len(key) < 2 || len(key) > 50 {
		return false
	}
	// ไม่เอาตัวแปรระบบของ Linux / Node / Git
	systemBlacklist := map[string]bool{
		"PATH": true, "PWD": true, "HOME": true, "USER": true, "HOSTNAME": true,
		"SHELL": true, "LANG": true, "LC_ALL": true, "TERM": true, "SHLVL": true,
		"NODE_ENV": true, "_": true,
	}
	if systemBlacklist[key] {
		return false
	}
	// ต้องขึ้นต้นด้วยตัวอักษรและมีเฉพาะตัวอักษร ตัวเลข หรือขีดล่าง
	match, _ := regexp.MatchString(`^[A-Za-z][A-Za-z0-9_]*$`, key)
	return match
}

func detectFramework(dir string) string {
	if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
		if data, err := os.ReadFile(filepath.Join(dir, "go.mod")); err == nil {
			modStr := string(data)
			if strings.Contains(modStr, "gin-gonic/gin") {
				return "Go (Gin Framework)"
			}
			if strings.Contains(modStr, "gofiber/fiber") {
				return "Go (Fiber Framework)"
			}
			if strings.Contains(modStr, "labstack/echo") {
				return "Go (Echo Framework)"
			}
		}
		return "Go"
	}

	if _, err := os.Stat(filepath.Join(dir, "package.json")); err == nil {
		if data, err := os.ReadFile(filepath.Join(dir, "package.json")); err == nil {
			pkgStr := string(data)
			if strings.Contains(pkgStr, `"next"`) {
				return "Next.js"
			}
			if strings.Contains(pkgStr, `"@nestjs/core"`) {
				return "NestJS"
			}
			if strings.Contains(pkgStr, `"express"`) {
				return "Node.js (Express)"
			}
			if strings.Contains(pkgStr, `"vite"`) {
				return "Vite (Frontend)"
			}
		}
		return "Node.js"
	}

	if _, err := os.Stat(filepath.Join(dir, "requirements.txt")); err == nil {
		if data, err := os.ReadFile(filepath.Join(dir, "requirements.txt")); err == nil {
			reqStr := strings.ToLower(string(data))
			if strings.Contains(reqStr, "fastapi") {
				return "Python (FastAPI)"
			}
			if strings.Contains(reqStr, "django") {
				return "Python (Django)"
			}
			if strings.Contains(reqStr, "flask") {
				return "Python (Flask)"
			}
		}
		return "Python"
	}

	return "Web Application"
}

// DetectFrontendAPIEnvKeys สแกนโค้ดและไฟล์ .env ใน Frontend เพื่อหาชื่อตัวแปรที่ใช้เชื่อมต่อกับ Backend โดยอัตโนมัติ (เช่น VITE_SERVER_URL, REACT_APP_BACKEND, NEXT_PUBLIC_API_URL ฯลฯ)
func DetectFrontendAPIEnvKeys(frontendDir string) []string {
	detectedMap := make(map[string]bool)

	// 1. Regex สแกนหาตัวแปร Frontend ยอดนิยมจากทุก Framework
	rePatterns := []*regexp.Regexp{
		regexp.MustCompile(`import\.meta\.env\.([A-Za-z0-9_]+)`),             // Vite (React/Vue/Svelte)
		regexp.MustCompile(`import\.meta\.env\[['"]([A-Za-z0-9_]+)['"]\]`),  // Vite bracket syntax
		regexp.MustCompile(`process\.env\.(NEXT_PUBLIC_[A-Za-z0-9_]+)`),      // Next.js
		regexp.MustCompile(`process\.env\.(REACT_APP_[A-Za-z0-9_]+)`),       // Create React App
		regexp.MustCompile(`(?:process\.env\.|env\.)?(NUXT_PUBLIC_[A-Za-z0-9_]+)`), // Nuxt
		regexp.MustCompile(`process\.env\.([A-Za-z0-9_]+)`),                 // General process.env
		regexp.MustCompile(`process\.env\[['"]([A-Za-z0-9_]+)['"]\]`),       // General bracket syntax
	}

	isAPIKeyword := func(key string) bool {
		upper := strings.ToUpper(key)
		return strings.Contains(upper, "URL") ||
			strings.Contains(upper, "URI") ||
			strings.Contains(upper, "API") ||
			strings.Contains(upper, "BACKEND") ||
			strings.Contains(upper, "SERVER") ||
			strings.Contains(upper, "HOST") ||
			strings.Contains(upper, "ENDPOINT") ||
			strings.Contains(upper, "BASE") ||
			strings.Contains(upper, "GATEWAY") ||
			strings.Contains(upper, "ORIGIN") ||
			strings.Contains(upper, "DOMAIN") ||
			strings.Contains(upper, "PROXY")
	}

	// 2. สแกนไฟล์ .env, .env.example, .env.sample ภายใน frontend directory
	_ = filepath.Walk(frontendDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			name := info.Name()
			if name == ".git" || name == "node_modules" || name == "dist" || name == ".next" {
				return filepath.SkipDir
			}
			return nil
		}

		baseName := strings.ToLower(info.Name())
		if strings.HasPrefix(baseName, ".env") || strings.HasSuffix(baseName, ".env") {
			if file, err := os.Open(path); err == nil {
				scanner := bufio.NewScanner(file)
				for scanner.Scan() {
					line := strings.TrimSpace(scanner.Text())
					if line == "" || strings.HasPrefix(line, "#") {
						continue
					}
					parts := strings.SplitN(line, "=", 2)
					key := strings.TrimSpace(parts[0])
					if isAPIKeyword(key) {
						detectedMap[key] = true
					}
				}
				file.Close()
			}
		}

		// 3. สแกนไฟล์ Source code (.js, .jsx, .ts, .tsx, .vue, .svelte, .html)
		ext := strings.ToLower(filepath.Ext(path))
		if ext == ".js" || ext == ".jsx" || ext == ".ts" || ext == ".tsx" || ext == ".vue" || ext == ".svelte" || ext == ".html" {
			if info.Size() < 500*1024 {
				if contentBytes, err := os.ReadFile(path); err == nil {
					content := string(contentBytes)
					for _, re := range rePatterns {
						for _, m := range re.FindAllStringSubmatch(content, -1) {
							if len(m) > 1 {
								key := m[1]
								if isAPIKeyword(key) {
									detectedMap[key] = true
								}
							}
						}
					}
				}
			}
		}
		return nil
	})

	// Default fallback keys ที่จำเป็นเสมอ
	defaultKeys := []string{"VITE_API_URL", "VITE_SERVER_URL", "BACKEND_URL", "API_URL", "REACT_APP_API_URL", "NEXT_PUBLIC_API_URL", "NUXT_PUBLIC_API_URL"}
	for _, k := range defaultKeys {
		detectedMap[k] = true
	}

	var result []string
	for k := range detectedMap {
		result = append(result, k)
	}
	return result
}

