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

// 1. เพิ่มพารามิเตอร์ buildDir เข้ามา

func GenerateDockerfile(ctx context.Context, repoURL string, buildDir string) (string, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("ไม่พบ GEMINI_API_KEY ในระบบ")
	}

	aiClient, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		return "", fmt.Errorf("เชื่อมต่อ AI ไม่สำเร็จ: %w", err)
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

	prompt := fmt.Sprintf(`คุณคือ DevOps Engineer ระดับ Senior ทำหน้าที่สร้าง Dockerfile สำหรับ Production ให้ถูกต้อง แม่นยำ และทำงานได้จริง 100%%
GitHub Repository: %s

[รายชื่อโฟลเดอร์และไฟล์ทั้งหมดในโปรเจกต์]:
%s

[เนื้อหาไฟล์ Config สำคัญที่อ่านได้จากในโปรเจกต์จริง]:
%s

คำแนะนำและกฎเหล็กในการสร้าง Dockerfile:
1. การเลือก Base Image และเวอร์ชัน (ห้ามเดา ให้ดูจากเนื้อหาไฟล์ Config ด้านบน):
   - หากเป็น Go: ตรวจสอบบรรทัด 'go x.xx' ใน go.mod เสมอ ถ้าโค้ดต้องการ Go 1.22+ หรือ 1.23+ ให้ใช้ 'FROM golang:1.23-alpine' หรือ 'FROM golang:alpine' ห้ามใช้ golang:1.20 หรือ golang:1.21 เด็ดขาด
   - หากเป็น Node.js / Frontend: ดูใน package.json ว่าใช้ node หรือเครื่องมืออะไร แนะนำใช้ 'FROM node:20-alpine' เป็น builder
   - หากเป็น Python: ดูจาก requirements.txt หรือ pyproject.toml ใช้ 'FROM python:3.11-slim' หรือ 'FROM python:3.12-slim'

2. เรื่อง Package Manager:
   - หากตรวจพบ "pnpm-lock.yaml": ห้ามใช้ npm เด็ดขาด! ให้ลง pnpm และตั้งค่าอนุญาต build scripts เสมอ เพื่อป้องกัน error ERR_PNPM_IGNORED_BUILDS:
     RUN npm install -g pnpm && pnpm config set enable-pre-post-scripts true
     จากนั้นใช้คำสั่ง: 'pnpm install --no-frozen-lockfile'
   - หากตรวจพบ "yarn.lock": ให้ใช้ 'yarn install'
   - หากใช้ npm: ใช้ 'npm install --legacy-peer-deps'

3. วิธีการ Build สำหรับ Monorepo ที่มีโฟลเดอร์ frontend/ (สำคัญที่สุด):
   - หากโปรเจกต์มีโฟลเดอร์ frontend/ ให้เน้นการสร้าง Dockerfile เพื่อ Build และ Host หน้าเว็บ Frontend เท่านั้น!
   - ห้ามสั่ง build backend (ห้ามสั่ง go build หรือติดตั้ง backend ใดๆ ทั้งสิ้น) เพราะเป้าหมายคือให้ผู้ใช้เข้าใช้งาน UI ทาง Web Browser
   - ให้สโคปการทำงานเฉพาะโฟลเดอร์ frontend/ โดยใช้ node:20-alpine builder:
     WORKDIR /app/frontend
     COPY frontend/package.json frontend/pnpm-lock.yaml* frontend/yarn.lock* frontend/package-lock.json* ./
     RUN npm install -g pnpm && pnpm config set enable-pre-post-scripts true && pnpm install --no-frozen-lockfile
     COPY frontend/ ./
     RUN pnpm run generate || pnpm run build
   - Stage สุดท้าย: ให้ใช้ nginx:alpine แล้ว RUN rm -rf /usr/share/nginx/html/* จากนั้น COPY ไฟล์ output จากการ build (มองหา .output/public หรือ dist) ไปไว้ที่ /usr/share/nginx/html/ EXPOSE 80

4. ข้อห้ามสำคัญ:
   - ตอบกลับมาแค่ตัวโค้ด Dockerfile ล้วนๆ เท่านั้น ห้ามมีคำอธิบาย และห้ามมีเครื่องหมาย markdown block code ใดๆ ทั้งสิ้น`,
		repoURL, fileListStr, configsStr)

	fmt.Println("🤖 กำลังส่ง Prompt พร้อมรายชื่อไฟล์ไปยัง AI...")

	aiResp, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		return "", fmt.Errorf("AI สร้างโค้ดไม่สำเร็จ: %w", err)
	}

	if len(aiResp.Candidates) == 0 || aiResp.Candidates[0].Content == nil {
		return "", fmt.Errorf("AI ตอบกลับมาเป็นค่าว่าง (No Content)")
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
		// ตัดบรรทัดแรกทิ้ง เช่น ```dockerfile หรือ ```docker หรือ ```
		if idx := strings.Index(finalDockerfile, "\n"); idx != -1 {
			finalDockerfile = finalDockerfile[idx+1:]
		}
	}
	if strings.HasSuffix(finalDockerfile, "```") {
		finalDockerfile = strings.TrimSuffix(finalDockerfile, "```")
	}
	finalDockerfile = strings.TrimSpace(finalDockerfile)

	return finalDockerfile, nil
}
