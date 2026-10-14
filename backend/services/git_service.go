package services

import (
	"fmt"
	"os"
	"os/exec"
)

func CloneRepository(repoURL string) (string, error) {
	buildDir, err := os.MkdirTemp("", "deploy-*")
	if err != nil {
		return "", fmt.Errorf("สร้างพื้นที่ทำงานไม่สำเร็จ: %w", err)
	}

	fmt.Println("📂 สร้าง Workspace ที่:", buildDir)
	fmt.Println("⬇️ กำลังโหลดโค้ดจาก:", repoURL)

	cmd := exec.Command("git", "clone", repoURL, buildDir)
	if output, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("Git Clone ไม่สำเร็จ: %s", string(output))
	}

	return buildDir, nil
}
