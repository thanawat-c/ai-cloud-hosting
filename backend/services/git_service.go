package services

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

func CloneRepository(repoURL string, gitToken ...string) (string, error) {
	buildDir, err := os.MkdirTemp("", "deploy-*")
	if err != nil {
		return "", fmt.Errorf("สร้างพื้นที่ทำงานไม่สำเร็จ: %w", err)
	}

	cloneURL := repoURL
	token := ""
	if len(gitToken) > 0 && strings.TrimSpace(gitToken[0]) != "" {
		token = strings.TrimSpace(gitToken[0])
		// แทรก Token ลงใน URL: https://oauth2:<TOKEN>@github.com/...
		if strings.HasPrefix(cloneURL, "https://") {
			cloneURL = strings.Replace(cloneURL, "https://", fmt.Sprintf("https://oauth2:%s@", token), 1)
		} else if strings.HasPrefix(cloneURL, "http://") {
			cloneURL = strings.Replace(cloneURL, "http://", fmt.Sprintf("http://oauth2:%s@", token), 1)
		}
	}

	fmt.Println("📂 สร้าง Workspace ที่:", buildDir)
	fmt.Println("⬇️ กำลังโหลดโค้ดจาก:", repoURL) // ปลอดภัย: แสดงเฉพาะ URL ดั้งเดิม ไม่แสดง token

	cmd := exec.Command("git", "clone", cloneURL, buildDir)
	if output, err := cmd.CombinedOutput(); err != nil {
		outStr := string(output)
		if token != "" {
			// Mask token จาก error message ไม่ให้หลุดไปใน log
			outStr = strings.ReplaceAll(outStr, token, "******")
		}
		return "", fmt.Errorf("Git Clone ไม่สำเร็จ: %s", outStr)
	}

	return buildDir, nil
}
