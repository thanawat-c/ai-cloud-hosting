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
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return "", "", fmt.Errorf("ไม่พบ GEMINI_API_KEY ในระบบ")
	}

	aiClient, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		return "", "", fmt.Errorf("เชื่อมต่อ AI ไม่สำเร็จ: %w", err)
	}
	defer aiClient.Close()

	// 2. ให้ Go สแกนหาโครงสร้างโฟลเดอร์ และ "อ่านเนื้อหาไฟล์ Config สำคัญ" ส่งให้ AI
	var fileList []string
	var configContents []string

	// สแกน Root
	entries, _ := os.ReadDir(buildDir)
	for _, e := range entries {
		name := e.Name()
		if name == ".git" {
			continue
		}
		if e.IsDir() {
			fileList = append(fileList, name+"/")
			// สแกนโฟลเดอร์ย่อย 1 ชั้น เช่น frontend, backend, client, server
			subEntries, _ := os.ReadDir(filepath.Join(buildDir, name))
			for _, sub := range subEntries {
				subName := sub.Name()
				if subName == "package.json" || subName == "go.mod" || subName == "requirements.txt" || subName == "pnpm-lock.yaml" || subName == "yarn.lock" || subName == "nuxt.config.ts" {
					subPath := filepath.Join(buildDir, name, subName)
					if subName != "pnpm-lock.yaml" && subName != "yarn.lock" {
						if data, err := os.ReadFile(subPath); err == nil {
							// ตัดให้ไม่เกิน 1500 ตัวอักษรเพื่อประหยัด token แต่ได้ข้อมูลครบ
							contentStr := string(data)
							if len(contentStr) > 1500 {
								contentStr = contentStr[:1500] + "\n...(ตัดข้อมูลส่วนที่เหลือ)..."
							}
							configContents = append(configContents, fmt.Sprintf("--- เนื้อหาไฟล์ %s/%s ---\n%s", name, subName, contentStr))
						}
					} else {
						configContents = append(configContents, fmt.Sprintf("ตรวจพบไฟล์ Lockfile: %s/%s", name, subName))
					}
				}
			}
		} else {
			fileList = append(fileList, name)
			if name == "package.json" || name == "go.mod" || name == "requirements.txt" {
				if data, err := os.ReadFile(filepath.Join(buildDir, name)); err == nil {
					contentStr := string(data)
					if len(contentStr) > 1500 {
						contentStr = contentStr[:1500] + "\n...(ตัดข้อมูลส่วนที่เหลือ)..."
					}
					configContents = append(configContents, fmt.Sprintf("--- เนื้อหาไฟล์ %s ---\n%s", name, contentStr))
				}
			} else if name == "pnpm-lock.yaml" || name == "yarn.lock" {
				configContents = append(configContents, fmt.Sprintf("ตรวจพบไฟล์ Lockfile: %s", name))
			}
		}
	}

	fileListStr := strings.Join(fileList, ", ")
	configsStr := strings.Join(configContents, "\n\n")

	model := aiClient.GenerativeModel("gemini-2.5-flash")

	var targetInstruction string
	if targetDir == "backend" {
		targetInstruction = `เป้าหมายรอบนี้: สร้าง Dockerfile สำหรับรัน [Backend Service] เท่านั้น!
- สแกนดูภาษาของ backend (เช่น Go, Python, Node.js)
- หากเป็น Go: ให้ตรวจเวอร์ชันจาก go.mod ถ้า go.mod ต้องการเวอร์ชันใหม่ ให้ใช้ FROM golang:alpine AS builder และใส่ ENV GOTOOLCHAIN=auto
- ให้ดูว่า main.go อยู่ที่ไหน เช่นถ้าอยู่ใน ./backend/cmd/api หรือ ./backend ให้ cd/WORKDIR เข้าไป build ให้ถูกที่ เช่น:
  FROM golang:alpine AS builder
  ENV GOTOOLCHAIN=auto
  WORKDIR /app/backend
  COPY backend/go.mod backend/go.sum* ./
  RUN go mod download
  COPY backend/ ./
  RUN CGO_ENABLED=0 go build -o /app/server ./cmd/api || CGO_ENABLED=0 go build -o /app/server .
  FROM alpine:latest
  WORKDIR /app
  COPY --from=builder /app/server .
  EXPOSE 8080
  CMD ["/app/server"]
- EXPOSE พอร์ตที่ backend รันจริง (เช่น 8080, 3000, 5000)`
	} else if targetDir == "frontend" {
		targetInstruction = `เป้าหมายรอบนี้: สร้าง Dockerfile สำหรับรัน [Frontend Service] เท่านั้น!
- สโคปการทำงานเฉพาะโฟลเดอร์ frontend/ โดยใช้ node:22-alpine builder:
  WORKDIR /app/frontend
  COPY frontend/package.json frontend/pnpm-lock.yaml* frontend/yarn.lock* frontend/package-lock.json* ./
  RUN npm install -g pnpm@9 && pnpm install --no-frozen-lockfile
  COPY frontend/ ./
  RUN pnpm run generate || pnpm run build
- Stage สุดท้าย: ให้ใช้ nginx:alpine แล้ว RUN rm -rf /usr/share/nginx/html/*
- COPY ไฟล์ output จากการ build (.output/public หรือ dist) ไปไว้ที่ /usr/share/nginx/html/
- [สำคัญมาก]: ให้ COPY nginx.conf /etc/nginx/conf.d/default.conf (ไฟล์ nginx.conf ได้ถูกสร้างไว้ที่ root แล้ว) เพื่อทำ Reverse Proxy ส่งต่อ /api/ ไปยัง backend ได้ถูกต้อง
- EXPOSE 80`
	} else {
		targetInstruction = `หากพบโฟลเดอร์ frontend/ ให้เน้นการสร้าง Dockerfile เพื่อ Build และ Host หน้าเว็บ Frontend พอร์ต 80`
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
2. อย่าลืมใส่คำสั่ง EXPOSE <port> ใน Dockerfile เสมอ (เช่น EXPOSE 80 สำหรับ Nginx หรือ EXPOSE 8080 สำหรับ Go backend)
3. ตอบกลับมาแค่ตัวโค้ด Dockerfile ล้วนๆ เท่านั้น ห้ามมีคำอธิบาย และห้ามมีเครื่องหมาย markdown block code ใดๆ ทั้งสิ้น`,
		repoURL, targetInstruction, fileListStr, configsStr)

	fmt.Printf("🤖 กำลังส่ง Prompt ให้ AI สร้าง Dockerfile สำหรับ %s...\n", targetDir)

	aiResp, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		return "", "80", fmt.Errorf("AI สร้างโค้ดไม่สำเร็จ: %w", err)
	}

	if len(aiResp.Candidates) == 0 || aiResp.Candidates[0].Content == nil {
		return "", "80", fmt.Errorf("AI ตอบกลับมาเป็นค่าว่าง (No Content)")
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
		summary = append(summary, fmt.Sprintf("โฟลเดอร์ '%s': มีไฟล์ภายในคือ [%s]", e.Name(), strings.Join(subNames, ", ")))
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

