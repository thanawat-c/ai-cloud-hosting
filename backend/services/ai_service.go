package services

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/option"
)

// GenerateDockerfile generates a production Dockerfile for either the full project or a specific target folder (e.g. backend/ or frontend/)
func GenerateDockerfile(ctx context.Context, repoURL string, buildDir string, targetDir string, backendEndpoint ...string) (string, string, error) {
	var endpoint string
	if len(backendEndpoint) > 0 {
		endpoint = backendEndpoint[0]
	}
	isBackend := targetDir == "backend" || strings.HasSuffix(targetDir, "/backend")
	isFrontend := targetDir == "frontend" || strings.HasSuffix(targetDir, "/frontend")

	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		fmt.Printf("⚠️ [No GEMINI_API_KEY] กำลังสลับใช้ Smart Fallback Template สำหรับ %s...\n", targetDir)
		return generateFallbackDockerfile(buildDir, targetDir, isBackend, isFrontend, endpoint)
	}

	aiClient, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		fmt.Printf("⚠️ [AI Client Error] (%v) กำลังสลับใช้ Smart Fallback Template สำหรับ %s...\n", err, targetDir)
		return generateFallbackDockerfile(buildDir, targetDir, isBackend, isFrontend, endpoint)
	}
	defer aiClient.Close()

	// 2. ให้ Go สแกนหาโครงสร้างโฟลเดอร์ และ "อ่านเนื้อหาไฟล์ Config สำคัญ" ส่งให้ AI
	var fileList []string
	var configContents []string

	isConfigFile := func(name string) bool {
		switch name {
		case "package.json", "go.mod", "go.sum", "requirements.txt", "pyproject.toml", "Pipfile",
			"pom.xml", "build.gradle", "build.gradle.kts", "Cargo.toml", "composer.json",
			"vite.config.ts", "vite.config.js", "next.config.js", "next.config.mjs", "next.config.ts",
			"nuxt.config.ts", "nuxt.config.js", "docker-compose.yml":
			return true
		}
		return false
	}

	isLockFile := func(name string) bool {
		switch name {
		case "pnpm-lock.yaml", "yarn.lock", "package-lock.json", "bun.lockb",
			"Cargo.lock", "composer.lock", "poetry.lock", "Pipfile.lock":
			return true
		}
		return false
	}

	addConfigFile := func(relPath string, fullPath string) {
		if data, err := os.ReadFile(fullPath); err == nil {
			contentStr := string(data)
			if len(contentStr) > 1500 {
				contentStr = contentStr[:1500] + "\n...(ตัดข้อมูลส่วนที่เหลือ)..."
			}
			configContents = append(configContents, fmt.Sprintf("--- เนื้อหาไฟล์ %s ---\n%s", relPath, contentStr))
		}
	}

	// สแกน Root และโฟลเดอร์ย่อย (รองรับทั้ง mono-repo ปกติ และ monorepo แบบ apps/...)
	entries, _ := os.ReadDir(buildDir)
	for _, e := range entries {
		name := e.Name()
		if strings.HasPrefix(name, ".") {
			continue
		}
		if e.IsDir() {
			fileList = append(fileList, name+"/")
			subEntries, _ := os.ReadDir(filepath.Join(buildDir, name))
			for _, sub := range subEntries {
				subName := sub.Name()
				if strings.HasPrefix(subName, ".") {
					continue
				}
				relSubPath := filepath.Join(name, subName)
				if sub.IsDir() {
					fileList = append(fileList, relSubPath+"/")
					// สแกนชั้นที่ 2 สำหรับ apps/web, apps/api
					if name == "apps" || name == "packages" || name == "services" {
						subSubEntries, _ := os.ReadDir(filepath.Join(buildDir, name, subName))
						for _, ss := range subSubEntries {
							ssName := ss.Name()
							relSSPath := filepath.Join(name, subName, ssName)
							if isConfigFile(ssName) {
								addConfigFile(relSSPath, filepath.Join(buildDir, relSSPath))
							} else if isLockFile(ssName) {
								configContents = append(configContents, fmt.Sprintf("ตรวจพบ Lockfile: %s", relSSPath))
							}
						}
					}
				} else {
					if isConfigFile(subName) {
						addConfigFile(relSubPath, filepath.Join(buildDir, relSubPath))
					} else if isLockFile(subName) {
						configContents = append(configContents, fmt.Sprintf("ตรวจพบ Lockfile: %s", relSubPath))
					}
				}
			}
		} else {
			fileList = append(fileList, name)
			if isConfigFile(name) {
				addConfigFile(name, filepath.Join(buildDir, name))
			} else if isLockFile(name) {
				configContents = append(configContents, fmt.Sprintf("ตรวจพบ Lockfile: %s", name))
			}
		}
	}

	fileListStr := strings.Join(fileList, ", ")
	configsStr := strings.Join(configContents, "\n\n")

	model := aiClient.GenerativeModel("gemini-2.5-flash")

	var targetInstruction string
	isFrontend = len(backendEndpoint) > 0 && backendEndpoint[0] != ""
	isBackend = targetDir != "" && !isFrontend

	if isBackend {
		targetInstruction = fmt.Sprintf(`เป้าหมายรอบนี้: สร้าง Dockerfile สำหรับรัน [Backend Service] ที่โฟลเดอร์ "%s/" เท่านั้น!
- สแกนดูภาษาและ framework ของโฟลเดอร์ "%s/" (เช่น Go, Python, Node.js, Java, Rust, PHP)
- เลือก Base Image ให้เหมาะสม (Go: golang:alpine พร้อม ENV GOTOOLCHAIN=auto, Node: node:22-alpine, Python: python:3.11-slim)
- คัดลอกและ Build จากโฟลเดอร์เป้าหมาย "%s/" ให้ถูกต้อง เช่น:
  * หากเป็น Go:
    FROM golang:alpine AS builder
    ENV GOTOOLCHAIN=auto
    WORKDIR /app/%s
    COPY %s/go.mod %s/go.sum* ./
    RUN go mod download
    COPY %s/ ./
    RUN CGO_ENABLED=0 go build -o /app/server . || CGO_ENABLED=0 go build -o /app/server ./cmd/...
    FROM alpine:latest
    WORKDIR /app
    COPY --from=builder /app/server .
    EXPOSE <port>
    CMD ["/app/server"]
  * หากเป็น Node.js / TypeScript:
    FROM node:22-alpine AS builder
    WORKDIR /app/%s
    COPY %s/package.json %s/*lock* ./
    RUN (ตรวจ lockfile แล้วรัน pnpm/yarn/npm install)
    COPY %s/ ./
    RUN (ถ้ามี build script ให้รัน npm run build หรือ pnpm run build)
    EXPOSE <port>
    CMD ["node", ...] หรือ CMD ["npm", "start"]
  * หากเป็น Python:
    FROM python:3.11-slim
    WORKDIR /app/%s
    COPY %s/requirements.txt* %s/pyproject.toml* ./
    RUN pip install --no-cache-dir -r requirements.txt
    COPY %s/ ./
    EXPOSE <port>
    CMD ["uvicorn", ...] หรือ CMD ["python", "main.py"]
- กำหนด EXPOSE พอร์ตที่ backend รันจริง (เช่น 8080, 8000, 3000, 5000)`, targetDir, targetDir, targetDir, targetDir, targetDir, targetDir, targetDir, targetDir, targetDir, targetDir, targetDir, targetDir, targetDir, targetDir, targetDir)
	} else if isFrontend {
		backendURL := endpoint
		if backendURL != "" && !strings.HasPrefix(backendURL, "http://") && !strings.HasPrefix(backendURL, "https://") {
			backendURL = "http://" + backendURL
		}
		targetInstruction = fmt.Sprintf(`เป้าหมายรอบนี้: สร้าง Dockerfile สำหรับรัน [Frontend Service] ที่โฟลเดอร์ "%s/" เท่านั้น!
- สโคปการทำงานเฉพาะโฟลเดอร์ "%s/"
- ตรวจสอบ Package Manager จาก lockfile (pnpm, yarn, npm, bun) เพื่อติดตั้ง dependency ให้ตรงรุ่น
- เซิร์ฟเวอร์ Backend ทำงานอยู่ที่: "%s"
- สำคัญมาก! ต้องกำหนด Environment Variables ชี้ไปยัง Backend ก่อนรัน Build และใน Runtime Stage เสมอ:
    ENV BACKEND_URL=%s
    ENV API_URL=%s
    ENV NUXT_PUBLIC_API_URL=%s
    ENV VITE_API_URL=%s
    ENV NEXT_PUBLIC_API_URL=%s
- ขั้นตอนการ Build:
  WORKDIR /app/%s
  COPY %s/package.json %s/*lock* ./
  (รันคำสั่งติดตั้ง dependencies ตาม lockfile เช่น npm ci, pnpm install, yarn install)
  COPY %s/ ./
  (ต้องใส่ ENV BACKEND_URL=%s และตัวแปรด้านบนก่อนคำสั่งรัน build เพื่อให้ frameworks เช่น Nuxt/Next/Vite compile proxy และ API URL ได้ถูกต้อง)
  (รัน build script เช่น pnpm run build หรือ pnpm run generate หรือ npm run build)
- Stage สุดท้าย:
  * หากเป็น Static Web App (Vite, React, Vue, Nuxt static):
    FROM nginx:alpine
    RUN rm -rf /usr/share/nginx/html/*
    COPY --from=builder /app/%s/(dist หรือ .output/public หรือ build) /usr/share/nginx/html/
    COPY nginx.conf /etc/nginx/conf.d/default.conf
    EXPOSE 80
    CMD ["nginx", "-g", "daemon off;"]
  * หากเป็น SSR App (Next.js standalone, Nuxt node-server):
    (ต้องใส่ ENV BACKEND_URL=%s และ ENV API_URL=%s ใน Runtime Stage นี้ด้วยเพื่อให้ SSR หรือ Server Proxy เรียก Backend ถูกต้อง)
    EXPOSE 3000
    CMD ["node", ...] หรือ CMD ["npm", "start"]`, targetDir, targetDir, backendURL, backendURL, backendURL, backendURL, backendURL, backendURL, targetDir, targetDir, targetDir, targetDir, backendURL, targetDir, backendURL, backendURL)
	} else {
		targetInstruction = `เป้าหมายรอบนี้: สร้าง Dockerfile สำหรับ [Standalone Project] ที่อยู่ที่ Root directory:
- สแกนดูไฟล์และ config ใน Root เพื่อระบุประเภทโปรเจกต์ (Go, Node.js, Python, Java, PHP, Rust, หรือ Web Frontend)
- หากเป็น Backend API:
  * สร้าง Dockerfile ที่ build และรัน service นั้นอย่างเหมาะสมตาม Best Practice
  * EXPOSE พอร์ตตามที่แอปพลิเคชันใช้งานจริง (เช่น 8080, 8000, 3000, 5000)
- หากเป็น Static Web Frontend (Vite, React, Vue, HTML):
  * Build ด้วย Node แล้วใช้ nginx:alpine host ที่พอร์ต 80
  * ใส่ Nginx config รองรับ SPA Fallback (try_files $uri $uri/ /index.html)
  * EXPOSE 80
- หากเป็น SSR Web Framework (Next.js, Nuxt SSR, Remix, SvelteKit):
  * Build และรันในโหมด Node.js server
  * EXPOSE 3000`
	}

	prompt := fmt.Sprintf(`คุณคือ DevOps Engineer ระดับ Senior ทำหน้าที่สร้าง Dockerfile สำหรับ Production ให้ถูกต้อง แม่นยำ และทำงานได้จริง 100%%
GitHub Repository: %s

[เป้าหมายการ Build รอบนี้]:
%s

[รายชื่อโฟลเดอร์และไฟล์ทั้งหมดในโปรเจกต์]:
%s

[เนื้อหาไฟล์ Config สำคัญที่อ่านได้จากในโปรเจกต์จริง]:
%s

คำแนะนำและกฎเหล็ก:
1. ให้เลือก Base Image ให้ตรงกับ Config จริง (Go ให้ใช้ golang:alpine พร้อม ENV GOTOOLCHAIN=auto เพื่อรองรับ go.mod เวอร์ชันใหม่ล่าสุด, Frontend ใช้ node:22-alpine, Python ใช้ python:3.11-slim)
2. หากโปรเจกต์ Node.js มีการใช้ pnpm (มี pnpm-lock.yaml) ต้องใส่คำสั่ง RUN npm install -g pnpm@9 ก่อนเรียกคำสั่ง pnpm เสมอ เพราะ base image ไม่มี pnpm ติดมาด้วย และ pnpm@9 รองรับ lockfile version 9 ได้สมบูรณ์ที่สุด
3. หากโปรเจกต์ Node.js มีการใช้ yarn (มี yarn.lock) ให้ใส่คำสั่ง RUN corepack enable ก่อนเรียกคำสั่ง yarn เสมอ
4. อย่าลืมใส่คำสั่ง EXPOSE <port> ใน Dockerfile เสมอ (เช่น EXPOSE 80 สำหรับ Nginx หรือ EXPOSE 8080 สำหรับ Go backend)
5. ตอบกลับมาแค่ตัวโค้ด Dockerfile ล้วนๆ เท่านั้น ห้ามมีคำอธิบาย และห้ามมีเครื่องหมาย markdown block code ใดๆ ทั้งสิ้น`,
		repoURL, targetInstruction, fileListStr, configsStr)

	fmt.Printf("🤖 กำลังส่ง Prompt ให้ AI สร้าง Dockerfile สำหรับ %s...\n", targetDir)

	aiResp, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil || len(aiResp.Candidates) == 0 || aiResp.Candidates[0].Content == nil {
		fmt.Printf("⚠️ [AI Quota/Generation Error] (%v) กำลังสลับใช้ Smart Fallback Template สำหรับ %s...\n", err, targetDir)
		return generateFallbackDockerfile(buildDir, targetDir, isBackend, isFrontend, endpoint)
	}

	var finalDockerfile string
	for _, part := range aiResp.Candidates[0].Content.Parts {
		if text, ok := part.(genai.Text); ok {
			finalDockerfile += string(text)
		}
	}

	// Clean up markdown syntax if AI still outputs it
	finalDockerfile = strings.TrimSpace(finalDockerfile)
	if strings.HasPrefix(finalDockerfile, "```") {
		if idx := strings.Index(finalDockerfile, "\n"); idx != -1 {
			finalDockerfile = finalDockerfile[idx+1:]
		}
	}
	if strings.HasSuffix(finalDockerfile, "```") {
		finalDockerfile = strings.TrimSuffix(finalDockerfile, "```")
	}
	finalDockerfile = strings.TrimSpace(finalDockerfile)

	// แปลงให้ใช้ pnpm@9 เสมอ เพื่อป้องกันปัญหา ERR_PNPM_IGNORED_BUILDS ของ pnpm v10
	finalDockerfile = strings.ReplaceAll(finalDockerfile, "npm install -g pnpm\n", "npm install -g pnpm@9\n")
	finalDockerfile = strings.ReplaceAll(finalDockerfile, "npm install -g pnpm &&", "npm install -g pnpm@9 &&")
	finalDockerfile = strings.ReplaceAll(finalDockerfile, "npm i -g pnpm\n", "npm i -g pnpm@9\n")
	finalDockerfile = strings.ReplaceAll(finalDockerfile, "npm i -g pnpm &&", "npm i -g pnpm@9 &&")

	// Auto-fix: ป้องกันข้อผิดพลาดกรณี AI เรียกใช้ pnpm แต่ลืมติดตั้งลงใน base image
	if strings.Contains(finalDockerfile, "pnpm") && !strings.Contains(finalDockerfile, "install -g pnpm") && !strings.Contains(finalDockerfile, "corepack") {
		lines := strings.Split(finalDockerfile, "\n")
		var newLines []string
		injected := false
		for _, l := range lines {
			newLines = append(newLines, l)
			trimmedL := strings.TrimSpace(l)
			if !injected && (strings.HasPrefix(trimmedL, "FROM node:") || strings.HasPrefix(trimmedL, "FROM node ")) {
				newLines = append(newLines, "RUN npm install -g pnpm@9")
				injected = true
			}
		}
		if injected {
			finalDockerfile = strings.Join(newLines, "\n")
		}
	}

	// Auto-fix: ป้องกันกรณีใช้ yarn แต่ยังไม่ได้ enable corepack
	if strings.Contains(finalDockerfile, "yarn") && !strings.Contains(finalDockerfile, "install -g yarn") && !strings.Contains(finalDockerfile, "corepack") {
		lines := strings.Split(finalDockerfile, "\n")
		var newLines []string
		injected := false
		for _, l := range lines {
			newLines = append(newLines, l)
			trimmedL := strings.TrimSpace(l)
			if !injected && (strings.HasPrefix(trimmedL, "FROM node:") || strings.HasPrefix(trimmedL, "FROM node ")) {
				newLines = append(newLines, "RUN corepack enable")
				injected = true
			}
		}
		if injected {
			finalDockerfile = strings.Join(newLines, "\n")
		}
	}

	// แกะหา EXPOSE port จาก Dockerfile
	exposedPort := "80"
	for _, line := range strings.Split(finalDockerfile, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "EXPOSE ") {
			parts := strings.Fields(trimmed)
			if len(parts) >= 2 {
				exposedPort = parts[1]
				break
			}
		}
	}

	return finalDockerfile, exposedPort, nil
}

// MonorepoDetectionResult เก็บชื่อโฟลเดอร์ที่ AI วิเคราะห์เจอ
type MonorepoDetectionResult struct {
	IsMonorepo  bool   `json:"is_monorepo"`
	FrontendDir string `json:"frontend_dir"`
	BackendDir  string `json:"backend_dir"`
}

// DetectMonorepoServices ให้ AI ช่วยดูโครงสร้างโฟลเดอร์จริงว่าโฟลเดอร์ไหนคือ Frontend และโฟลเดอร์ไหนคือ Backend
func DetectMonorepoServices(ctx context.Context, buildDir string) (bool, string, string) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return false, "", ""
	}

	aiClient, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		return false, "", ""
	}
	defer aiClient.Close()

	var summary []string
	entries, _ := os.ReadDir(buildDir)
	for _, e := range entries {
		if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		subEntries, _ := os.ReadDir(filepath.Join(buildDir, e.Name()))
		var subNames []string
		for _, s := range subEntries {
			subNames = append(subNames, s.Name())
		}
		summary = append(summary, fmt.Sprintf("โฟลเดอร์ '%s': มีไฟล์/โฟลเดอร์ย่อยคือ [%s]", e.Name(), strings.Join(subNames, ", ")))

		// สแกนโฟลเดอร์ชั้นที่ 2 เพิ่มเติมสำหรับ Monorepo ยอดนิยม (เช่น apps/web, apps/api, packages/client, packages/server)
		if e.Name() == "apps" || e.Name() == "packages" || e.Name() == "services" {
			for _, sub := range subEntries {
				if sub.IsDir() && !strings.HasPrefix(sub.Name(), ".") {
					subSubEntries, _ := os.ReadDir(filepath.Join(buildDir, e.Name(), sub.Name()))
					var subSubNames []string
					for _, ss := range subSubEntries {
						subSubNames = append(subSubNames, ss.Name())
					}
					summary = append(summary, fmt.Sprintf("โฟลเดอร์ '%s/%s': มีไฟล์ภายในคือ [%s]", e.Name(), sub.Name(), strings.Join(subSubNames, ", ")))
				}
			}
		}
	}

	if len(summary) < 2 {
		return false, "", ""
	}

	prompt := fmt.Sprintf(`คุณคือ DevOps Architect วิเคราะห์โครงสร้างโฟลเดอร์ของโปรเจกต์ต่อไปนี้:
%s

คำถาม: โปรเจกต์นี้เป็น Fullstack Monorepo ที่มีทั้งส่วน Frontend (Web/UI) และ Backend (API/Server) แยกโฟลเดอร์กันหรือไม่?
(หมายเหตุ: ชื่อโฟลเดอร์อาจตั้งเป็น client/server, web/api, frontend/backend, app/api หรือชื่ออื่นๆ ก็ได้ ให้ดูจากไฟล์ภายใน)

ตอบกลับเป็นรูปแบบ JSON สั้นๆ เท่านั้น ตัวอย่าง:
{"is_monorepo": true, "frontend_dir": "frontend", "backend_dir": "backend"}
หรือหากไม่ใช่ Monorepo ให้ตอบ:
{"is_monorepo": false, "frontend_dir": "", "backend_dir": ""}

ห้ามใส่คำอธิบาย ห้ามใส่ markdown block ตอบเฉพาะ raw json ล้วนๆ`, strings.Join(summary, "\n"))

	model := aiClient.GenerativeModel("gemini-2.5-flash")
	model.ResponseMIMEType = "application/json"

	resp, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil || len(resp.Candidates) == 0 || resp.Candidates[0].Content == nil {
		return false, "", ""
	}

	var jsonStr string
	for _, part := range resp.Candidates[0].Content.Parts {
		if text, ok := part.(genai.Text); ok {
			jsonStr += string(text)
		}
	}

	var res MonorepoDetectionResult
	if err := json.Unmarshal([]byte(strings.TrimSpace(jsonStr)), &res); err != nil {
		return false, "", ""
	}

	return res.IsMonorepo && res.FrontendDir != "" && res.BackendDir != "", res.FrontendDir, res.BackendDir
}

// generateFallbackDockerfile สร้าง Dockerfile มาตรฐานโดยอัตโนมัติเมื่อ AI Rate Limit หรือ Quota หมด
func generateFallbackDockerfile(buildDir, targetDir string, isBackend, isFrontend bool, backendEndpoint string) (string, string, error) {
	fullTarget := filepath.Join(buildDir, targetDir)

	cleanPrefix := targetDir
	if cleanPrefix != "" && !strings.HasSuffix(cleanPrefix, "/") {
		cleanPrefix += "/"
	}

	copySource := cleanPrefix
	if copySource == "" {
		copySource = "."
	}

	workdir := "/app"
	if targetDir != "" {
		workdir = "/app/" + targetDir
	}

	// 1. ตรวจสอบกรณี Frontend (Nuxt, Vite, React, Vue, Static Web)
	if isFrontend || targetDir == "frontend" {
		pnpmLockPath := filepath.Join(fullTarget, "pnpm-lock.yaml")
		yarnLockPath := filepath.Join(fullTarget, "yarn.lock")

		setupPkgManager := "RUN npm install -g pnpm@9"
		installCmd := "pnpm install"
		buildCmd := "pnpm run generate || pnpm run build || npm run build"

		if _, err := os.Stat(pnpmLockPath); err == nil {
			setupPkgManager = "RUN npm install -g pnpm@9"
			installCmd = "pnpm install"
			buildCmd = "pnpm run generate || pnpm run build || npm run build"
		} else if _, err := os.Stat(yarnLockPath); err == nil {
			setupPkgManager = "RUN corepack enable"
			installCmd = "yarn install"
			buildCmd = "yarn generate || yarn build || npm run build"
		} else {
			setupPkgManager = ""
			installCmd = "npm install"
			buildCmd = "npm run generate || npm run build || true"
		}

		backendURL := backendEndpoint
		if backendURL != "" && !strings.HasPrefix(backendURL, "http://") && !strings.HasPrefix(backendURL, "https://") {
			backendURL = "http://" + backendURL
		}
		envSnippet := ""
		if backendURL != "" {
			envSnippet = fmt.Sprintf("ENV BACKEND_URL=%s\nENV API_URL=%s\nENV NUXT_PUBLIC_API_URL=%s\nENV VITE_API_URL=%s\n", backendURL, backendURL, backendURL, backendURL)
		}

		dockerfile := fmt.Sprintf(`FROM node:22-alpine AS builder
WORKDIR %s
%s
COPY %spackage.json %s*lock* ./
RUN %s
COPY %s ./
%sRUN %s
RUN mkdir -p /app/dist && (cp -r .output/public/* /app/dist/ 2>/dev/null || cp -r dist/* /app/dist/ 2>/dev/null || cp -r build/* /app/dist/ 2>/dev/null || true)

FROM nginx:alpine
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`, workdir, setupPkgManager, cleanPrefix, cleanPrefix, installCmd, copySource, envSnippet, buildCmd)

		return dockerfile, "80", nil
	}

	// 2. ตรวจสอบกรณี Go (มี go.mod)
	goModPath := filepath.Join(fullTarget, "go.mod")
	if _, err := os.Stat(goModPath); err == nil {
		dockerfile := fmt.Sprintf(`FROM golang:alpine AS builder
ENV GOTOOLCHAIN=auto
WORKDIR /app
COPY %sgo.mod %sgo.sum* ./
RUN go mod download
COPY %s ./
RUN CGO_ENABLED=0 go build -o /app/server . || CGO_ENABLED=0 go build -o /app/server ./cmd/...

FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/server .
EXPOSE 8080
CMD ["/app/server"]
`, cleanPrefix, cleanPrefix, copySource)

		return dockerfile, "8080", nil
	}

	// 3. กรณี Python
	reqPath := filepath.Join(fullTarget, "requirements.txt")
	if _, err := os.Stat(reqPath); err == nil {
		dockerfile := fmt.Sprintf(`FROM python:3.11-slim
WORKDIR /app
COPY %srequirements.txt* ./
RUN pip install --no-cache-dir -r requirements.txt
COPY %s ./
EXPOSE 8000
CMD ["python", "main.py"]
`, cleanPrefix, copySource)

		return dockerfile, "8000", nil
	}

	// 4. Default Node.js
	dockerfile := fmt.Sprintf(`FROM node:22-alpine
WORKDIR /app
COPY %spackage.json %s*lock* ./
RUN npm install
COPY %s ./
EXPOSE 3000
CMD ["npm", "start"]
`, cleanPrefix, cleanPrefix, copySource)

	return dockerfile, "3000", nil
}

