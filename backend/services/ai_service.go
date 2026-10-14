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
   - หากตรวจพบ "pnpm-lock.yaml": ห้ามใช้ npm เด็ดขาด! ให้ลง pnpm ด้วย 'RUN npm install -g pnpm' แล้วใช้ 'pnpm install'
   - หากตรวจพบ "yarn.lock": ให้ใช้ 'yarn install'
   - หากใช้ npm: ใช้ 'npm install --legacy-peer-deps'

3. วิธีการ Build สำหรับ Monorepo (มีโฟลเดอร์ frontend/ และ backend/):
   - ห้ามใช้ flag --prefix
   - ให้ใช้ WORKDIR เข้าไปทำงานในโฟลเดอร์นั้นๆ โดยตรง
   - ให้เลือกรัน Frontend เพื่อให้ผู้ใช้งานเข้าชมหน้าเว็บผ่าน Browser พอร์ต 80 ได้ โดยหากเป็น Nuxt หรือ Vite/React เมื่อ build เสร็จแล้ว ให้ copy โฟลเดอร์ผลลัพธ์ (เช่น .output/public หรือ dist) ไปใส่ใน nginx:alpine
   - ข้อสำคัญของ Nginx: ต้องมีคำสั่ง 'RUN rm -rf /usr/share/nginx/html/*' ก่อนทำการ COPY ไฟล์เว็บลงไป เพื่อไม่ให้ติดหน้า Default Nginx

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
	finalDockerfile = strings.TrimPrefix(finalDockerfile, "```docker\n")
	finalDockerfile = strings.TrimPrefix(finalDockerfile, "```\n")
	finalDockerfile = strings.TrimSuffix(finalDockerfile, "```")

	return finalDockerfile, nil
}
