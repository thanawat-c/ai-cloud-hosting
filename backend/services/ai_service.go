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

	// 2. ให้ Go สแกนหาโครงสร้างโฟลเดอร์และไฟล์สำคัญทั้งที่ Root และโฟลเดอร์ย่อย 1 ชั้น
	var fileList []string
	var details []string

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
				if subName == "package.json" || subName == "go.mod" || subName == "requirements.txt" || subName == "pom.xml" || subName == "nuxt.config.ts" || subName == "vite.config.js" || subName == "vite.config.ts" {
					details = append(details, fmt.Sprintf("พบ %s อยู่ในโฟลเดอร์ %s/", subName, name))
				}
			}
		} else {
			fileList = append(fileList, name)
			if name == "package.json" || name == "go.mod" || name == "requirements.txt" {
				details = append(details, fmt.Sprintf("พบ %s อยู่ที่ Root", name))
			}
		}
	}

	fileListStr := strings.Join(fileList, ", ")
	detailStr := strings.Join(details, "\n")

	model := aiClient.GenerativeModel("gemini-2.5-flash")

	prompt := fmt.Sprintf(`คุณคือ DevOps Engineer ระดับ Senior ทำหน้าที่สร้าง Dockerfile คุณภาพสูงสำหรับ Production ให้เหมาะสมกับโปรเจกต์นี้
GitHub URL: %s

[โครงสร้างโฟลเดอร์และไฟล์ที่ตรวจพบ]:
%s

[ข้อมูลไฟล์สำคัญที่ตรวจพบ]:
%s

คำแนะนำและกฎเหล็กในการสร้าง Dockerfile:
1. หากพบโฟลเดอร์ frontend/ (เช่น React, Vue, Nuxt, Vite):
   - หากเป็น Nuxt: ต้องใช้ Node.js builder (เช่น node:18-alpine หรือ node:20-alpine) ทำการ cd เข้าไปใน frontend/ ติดตั้ง dependency และสั่ง build จากนั้นเสิร์ฟ Node server หรือถ้าเป็น Static site ให้ copy ผลลัพธ์ไปไว้ที่ Nginx หรือรัน Node server ให้ถูกต้อง
   - หากเป็น Vite/React/Vue ทั่วไป: ให้ build frontend ใน stage แรก แล้ว copy โฟลเดอร์ build/dist ไปใส่ใน nginx:alpine
   - ข้อสำคัญมาก: หากใช้ Nginx ปลายทาง ต้องลบไฟล์ default html ของ nginx ก่อนเสมอ:
     RUN rm -rf /usr/share/nginx/html/*
     แล้วค่อย COPY ผลลัพธ์ไปที่ /usr/share/nginx/html/
2. หากเป็น Backend (เช่น Go, Node.js, Python):
   - เขียน Dockerfile สำหรับ build และรัน backend นั้นๆ
3. หากเป็น Monorepo ที่มีทั้ง frontend/ และ backend/:
   - ให้โฟกัสที่การ Build และเสิร์ฟหน้าเว็บ Frontend เป็นหลักก่อน เพื่อให้ผู้ใช้เข้าชมผ่าน Browser ได้
4. อย่าใส่ markdown format ใดๆ ทั้งสิ้น ห้ามใส่เครื่องหมาย block code ให้ตอบกลับเป็นตัวโค้ด Dockerfile ล้วนๆ เท่านั้น`,
		repoURL, fileListStr, detailStr)

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
