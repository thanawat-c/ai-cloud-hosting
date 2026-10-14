package services

import (
	"context"
	"fmt"
	"os"
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

	// 2. ให้ Go สอดแนมเข้าไปดูว่าในโฟลเดอร์มีไฟล์อะไรบ้าง
	files, _ := os.ReadDir(buildDir)
	var fileNames []string
	hasPackageJson := false
	for _, f := range files {
		fileNames = append(fileNames, f.Name())
		if f.Name() == "package.json" {
			hasPackageJson = true
		}
	}
		fileListStr := strings.Join(fileNames, ", ")


	model := aiClient.GenerativeModel("gemini-2.5-flash")

	prompt := fmt.Sprintf(`คุณคือ DevOps Engineer ระดับ Senior วิเคราะห์โปรเจกต์จาก GitHub URL นี้: %s 
	
	ข้อมูลสำคัญ: ฉันสแกนโฟลเดอร์โปรเจกต์มาให้แล้ว นี่คือรายชื่อไฟล์ทั้งหมดที่มี: [%s]
	มีไฟล์ package.json หรือไม่: %v
	
	จงเขียน Dockerfile สำหรับ Production ให้เหมาะสมกับไฟล์ที่มีอยู่จริง ตอบกลับมาแค่ตัวโค้ดเพียวๆ ห้ามมีเครื่องหมาย markdown 
	
	กฎเหล็ก:
	1. ถ้าไม่มี package.json แสดงว่าเป็น Static HTML ธรรมดา ให้ใช้ FROM nginx:alpine แล้ว COPY . /usr/share/nginx/html/ ได้เลย (คำสั่ง COPY ปลายทางต้องมี / ต่อท้ายเสมอเพื่อป้องกัน Error)
	2. ถ้ามี package.json ถึงจะใช้ Node.js เป็น builder
	3. ถ้าต้องแก้ config nginx ห้ามใช้ COPY จากภายนอก ให้ใช้วิธี RUN echo ทีละบรรทัด ห้ามใช้ Here-Doc`, 
	repoURL, fileListStr, hasPackageJson)

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
