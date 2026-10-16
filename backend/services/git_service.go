package services

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"time"
)

// BuildAuthenticatedGitURL จัดการ URL ให้พร้อมใช้งานทั้งกรณี Public และ Private Token
func BuildAuthenticatedGitURL(repoURL string, gitToken ...string) (string, string) {
	cloneURL := strings.TrimSpace(repoURL)
	token := ""
	if len(gitToken) > 0 && strings.TrimSpace(gitToken[0]) != "" {
		token = strings.TrimSpace(gitToken[0])
		if strings.HasPrefix(cloneURL, "https://") {
			cloneURL = strings.Replace(cloneURL, "https://", fmt.Sprintf("https://oauth2:%s@", token), 1)
		} else if strings.HasPrefix(cloneURL, "http://") {
			cloneURL = strings.Replace(cloneURL, "http://", fmt.Sprintf("http://oauth2:%s@", token), 1)
		}
	}
	return cloneURL, token
}

// TranslateGitError แปลง Error ดิบจากคำสั่ง Git ให้เป็นภาษาไทยที่กระชับและบอกวิธีแก้
func TranslateGitError(rawError string, repoURL string, token string) error {
	cleanMsg := rawError
	if token != "" {
		cleanMsg = strings.ReplaceAll(cleanMsg, token, "******")
	}

	// ลบ Path โฟลเดอร์ชั่วคราวที่ไม่จำเป็นออก เช่น "Cloning into '/var/folders/.../deploy-...'"
	reCloning := regexp.MustCompile(`(?i)cloning into '[^']+'\.{3}\s*`)
	cleanMsg = reCloning.ReplaceAllString(cleanMsg, "")
	cleanMsg = strings.TrimSpace(cleanMsg)

	lower := strings.ToLower(cleanMsg)

	// 1. กรณีไม่พบ Repository (404 / Typo / ถูกลบ)
	if strings.Contains(lower, "not found") || strings.Contains(lower, "repository not found") || strings.Contains(lower, "does not exist") {
		return fmt.Errorf("❌ ไม่พบ Repository บน Git: กรุณาตรวจสอบว่าสะกด URL ถูกต้อง หรือหากเป็น Private Repo ให้ระบุ Git Token ในเมนู Advanced Settings")
	}

	// 2. กรณีสิทธิ์เข้าถึง (Private Repo หรือ Token ไม่ถูกต้อง)
	if strings.Contains(lower, "authentication failed") ||
		strings.Contains(lower, "could not read username") ||
		strings.Contains(lower, "permission denied") ||
		strings.Contains(lower, "terminal prompts disabled") {
		return fmt.Errorf("🔒 ไม่มีสิทธิ์เข้าถึง Repository: อาจเป็น Private Repo หรือ Git Token ไม่ถูกต้อง กรุณาระบุ Personal Access Token ในเมนู Advanced Settings")
	}

	// 3. กรณี Network / DNS / Host
	if strings.Contains(lower, "could not resolve host") ||
		strings.Contains(lower, "connection timed out") ||
		strings.Contains(lower, "failed to connect") ||
		strings.Contains(lower, "network is unreachable") {
		return fmt.Errorf("🌐 ไม่สามารถเชื่อมต่อกับ Git Server ได้: กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือ URL ของ Server")
	}

	// กรณีอื่นๆ ส่งข้อความที่ตัดทอนให้กระชับ
	if cleanMsg == "" {
		cleanMsg = "เกิดข้อผิดพลาดในการดึงโค้ดจาก Git"
	}
	return fmt.Errorf("Git Clone ไม่สำเร็จ: %s", cleanMsg)
}

// ValidateGitRepository ตรวจสอบความถูกต้องและการเข้าถึงของ Repo ล่วงหน้า (Pre-flight check) ภายในไม่กี่ร้อย millisecond
func ValidateGitRepository(repoURL string, gitToken ...string) error {
	cleanRepoURL := strings.TrimSpace(repoURL)
	if cleanRepoURL == "" {
		return fmt.Errorf("กรุณาระบุ URL ของ Repository")
	}

	authURL, token := BuildAuthenticatedGitURL(cleanRepoURL, gitToken...)

	// กำหนด Timeout ไม่เกิน 8 วินาที เพื่อไม่ให้ระบบค้าง
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "git", "ls-remote", "--heads", authURL)
	// ป้องกันไม่ให้ Git ค้างรอ prompt ถาม username/password บน terminal
	cmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0")

	output, err := cmd.CombinedOutput()
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("⏳ หมดเวลาเชื่อมต่อ Git Server (Timeout): โปรดตรวจสอบ URL หรืออินเทอร์เน็ต")
		}
		return TranslateGitError(string(output), cleanRepoURL, token)
	}

	return nil
}

// CloneRepository ทำการดาวน์โหลด Repository โดยทำการ Pre-flight Validate ก่อนเสมอ
func CloneRepository(repoURL string, gitToken ...string) (string, error) {
	cleanRepoURL := strings.TrimSpace(repoURL)

	// Step 1: Pre-flight Check ความมีอยู่และสิทธิ์ของ Repo ก่อนสร้างโฟลเดอร์หรือเปลืองเน็ต
	if err := ValidateGitRepository(cleanRepoURL, gitToken...); err != nil {
		return "", err
	}

	// Step 2: สร้าง Workspace ชั่วคราว
	buildDir, err := os.MkdirTemp("", "deploy-*")
	if err != nil {
		return "", fmt.Errorf("สร้างพื้นที่ทำงานไม่สำเร็จ: %w", err)
	}

	authURL, token := BuildAuthenticatedGitURL(cleanRepoURL, gitToken...)

	fmt.Println("📂 สร้าง Workspace ที่:", buildDir)
	fmt.Println("⬇️ กำลังดาวน์โหลดโค้ดจาก:", cleanRepoURL)

	cmd := exec.Command("git", "clone", authURL, buildDir)
	cmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0")

	if output, err := cmd.CombinedOutput(); err != nil {
		// หาก Clone ผิดพลาด ให้ล้าง Workspace ทันที
		os.RemoveAll(buildDir)
		return "", TranslateGitError(string(output), cleanRepoURL, token)
	}

	return buildDir, nil
}
