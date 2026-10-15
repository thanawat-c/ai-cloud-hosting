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
}

// InspectRepository โคลน repo แบบตื้น (--depth 1) มาสแกนหาตัวแปรและโครงสร้างโค้ด
func InspectRepository(repoURL string, gitToken ...string) (*InspectResult, error) {
	tempDir, err := os.MkdirTemp("", "inspect-*")
	if err != nil {
		return nil, fmt.Errorf("สร้าง workspace ชั่วคราวไม่สำเร็จ: %w", err)
	}
	defer os.RemoveAll(tempDir)

	cloneURL := repoURL
	if len(gitToken) > 0 && strings.TrimSpace(gitToken[0]) != "" {
		token := strings.TrimSpace(gitToken[0])
		if strings.HasPrefix(cloneURL, "https://") {
			cloneURL = strings.Replace(cloneURL, "https://", fmt.Sprintf("https://oauth2:%s@", token), 1)
		}
	}

	// ใช้ --depth 1 เพื่อความรวดเร็วระดับวินาที
	cmd := exec.Command("git", "clone", "--depth", "1", cloneURL, tempDir)
	if output, err := cmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("Git Clone ไม่สำเร็จ: %s", string(output))
	}

	result := &InspectResult{
		DetectedEnvs: []string{},
		DBVarNames:   []string{},
	}

	envMap := make(map[string]string)

	// 1. ตรวจหาไฟล์ .env.example หรือไฟล์ template อื่นๆ
	sampleFiles := []string{
		".env.example", ".env.sample", ".env.template", ".env.local.example",
		"example.env", "sample.env", "env.example",
	}

	var foundSampleFile string
	_ = filepath.Walk(tempDir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		baseName := strings.ToLower(info.Name())
		for _, s := range sampleFiles {
			if baseName == s {
				foundSampleFile = path
				return filepath.SkipAll
			}
		}
		return nil
	})

	if foundSampleFile != "" {
		if file, err := os.Open(foundSampleFile); err == nil {
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
					envMap[key] = val
				}
			}
			file.Close()
		}
	}

	// 2. Regex สแกนหาการเรียกใช้ env ในไฟล์โค้ด (.go, .js, .ts, .py, .prisma)
	reGo := regexp.MustCompile(`(?:os\.Getenv|os\.LookupEnv)\(["']([A-Za-z0-9_]+)["']\)`)
	reNode := regexp.MustCompile(`process\.env\.([A-Za-z0-9_]+)`)
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
		if ext != ".go" && ext != ".js" && ext != ".ts" && ext != ".jsx" && ext != ".tsx" && ext != ".py" && ext != ".prisma" {
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
