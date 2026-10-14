package services

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/option"
)

// GenerateDockerfile generates a production Dockerfile for either the full project or a specific target folder (e.g. backend/ or frontend/)
func GenerateDockerfile(ctx context.Context, repoURL string, buildDir string, targetDir string) (string, string, error) {
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
- หากเป็น Go: ให้ดูว่า main.go อยู่ที่ไหน เช่นถ้าอยู่ใน ./backend/cmd/api หรือ ./backend ให้ cd/WORKDIR เข้าไป build ให้ถูกที่ เช่น:
  FROM golang:1.23-alpine AS builder
  WORKDIR /app/backend
  COPY backend/go.mod backend/go.sum ./
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
- Stage สุดท้าย: ให้ใช้ nginx:alpine แล้ว RUN rm -rf /usr/share/nginx/html/* จากนั้น COPY ไฟล์ output จากการ build (.output/public หรือ dist) ไปไว้ที่ /usr/share/nginx/html/
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
1. ให้เลือก Base Image ให้ตรงกับ Config จริง (Go ใช้ 1.23-alpine, Frontend ใช้ node:22-alpine, Python ใช้ python:3.11-slim)
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
