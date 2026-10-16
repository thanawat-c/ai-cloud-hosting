package controllers

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"ai-cloud-api/config"
	"ai-cloud-api/models"
	"ai-cloud-api/services"

	"github.com/gin-gonic/gin"
)

// GitHubWebhookPayload โครงสร้างข้อมูลที่ GitHub Push Event ส่งมา
type GitHubWebhookPayload struct {
	Ref        string `json:"ref"`
	Before     string `json:"before"`
	After      string `json:"after"`
	Repository struct {
		ID       int64  `json:"id"`
		Name     string `json:"name"`
		FullName string `json:"full_name"`
		HTMLURL  string `json:"html_url"`
		CloneURL string `json:"clone_url"`
	} `json:"repository"`
	Pusher struct {
		Name  string `json:"name"`
		Email string `json:"email"`
	} `json:"pusher"`
	HeadCommit struct {
		ID        string `json:"id"`
		Message   string `json:"message"`
		Timestamp string `json:"timestamp"`
		Author    struct {
			Name  string `json:"name"`
			Email string `json:"email"`
		} `json:"author"`
	} `json:"head_commit"`
	HookID int64 `json:"hook_id"` // ใช้ตรวจสอบกรณี Ping Event
}

// GenerateRandomSecret สร้าง Secret สุ่มสำหรับ Webhook
func GenerateRandomSecret() string {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "whsec_default_secret_key"
	}
	return "whsec_" + hex.EncodeToString(bytes)
}

// extractWebhookJSON แปลง payload ไม่ว่าจะส่งมาแบบ application/json หรือ form-urlencoded ให้เป็น JSON เสมอ
func extractWebhookJSON(c *gin.Context, bodyBytes []byte) []byte {
	rawStr := string(bodyBytes)
	if strings.HasPrefix(rawStr, "payload=") || strings.Contains(c.ContentType(), "application/x-www-form-urlencoded") {
		trimmed := strings.TrimPrefix(rawStr, "payload=")
		if unescaped, err := url.QueryUnescape(trimmed); err == nil {
			return []byte(unescaped)
		}
	}
	return bodyBytes
}

// VerifySignature ตรวจสอบ HMAC-SHA256 Signature ที่ส่งมาจาก GitHub Header
func VerifySignature(secret string, payload []byte, signatureHeader string) bool {
	if secret == "" {
		return true // ถ้าไม่ได้ตั้ง secret ให้ผ่าน
	}
	if signatureHeader == "" || !strings.HasPrefix(signatureHeader, "sha256=") {
		return false
	}
	expectedHash := signatureHeader[7:]
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	computedHash := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(computedHash), []byte(expectedHash))
}

// HandleDeploymentWebhook รับ Webhook สำหรับ Deployment เฉพาะ ID
// Route: POST /api/webhooks/deploy/:id
func HandleDeploymentWebhook(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Deployment ID"})
		return
	}

	var deploy models.Deployment
	if err := config.DB.First(&deploy, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Deployment not found"})
		return
	}

	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read request body"})
		return
	}

	// 1. ตรวจสอบความปลอดภัยผ่าน Secret (ถ้ามี)
	sigHeader := c.GetHeader("X-Hub-Signature-256")
	if deploy.WebhookSecret != "" && sigHeader != "" {
		if !VerifySignature(deploy.WebhookSecret, bodyBytes, sigHeader) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid Webhook Secret Signature"})
			return
		}
	}

	// 2. ตรวจสอบประเภท Event (กรณี GitHub ยิงทดสอบ Ping)
	eventType := c.GetHeader("X-GitHub-Event")
	if eventType == "ping" {
		c.JSON(http.StatusOK, gin.H{
			"message": "Pong! Webhook connection verified successfully.",
			"service": deploy.RepoURL,
		})
		return
	}

	rawJSON := extractWebhookJSON(c, bodyBytes)
	var payload GitHubWebhookPayload
	if err := json.Unmarshal(rawJSON, &payload); err != nil {
		fmt.Printf("⚠️ [Webhook Unmarshal Error] Deployment %d: %v | Raw: %s\n", id, err, string(bodyBytes))
	}

	commitMsg := payload.HeadCommit.Message
	pusherName := payload.Pusher.Name
	if pusherName == "" {
		pusherName = payload.HeadCommit.Author.Name
	}
	branch := strings.TrimPrefix(payload.Ref, "refs/heads/")

	fmt.Printf("🚀 [Webhook Triggered] Service: %s (ID: %d) | Branch: %s | Pusher: %s | Commit: %s\n",
		deploy.RepoURL, deploy.ID, branch, pusherName, commitMsg)

	// 3. ปรับสถานะเป็น redeploying ทันทีเพื่อให้หน้า Dashboard โชว์ Updating
	config.DB.Model(&deploy).Update("status", "redeploying")

	// สั่ง Re-deploy ใน Goroutine แบบ Asynchronous
	go func(targetDeploy models.Deployment, pusher, msg, br string) {
		ctx := context.Background()
		fmt.Printf("🔄 [Auto-Deploy] เริ่มดึงโค้ดล่าสุดจาก Git และสร้าง Image ใหม่สำหรับ %s...\n", targetDeploy.RepoURL)

		newID, err := services.RedeployApp(
			ctx,
			targetDeploy.ContainerID,
			targetDeploy.RepoURL,
			targetDeploy.ImageName,
			targetDeploy.ForceAI,
			targetDeploy.GitToken,
		)

		if err != nil {
			fmt.Printf("❌ [Auto-Deploy Failed] %s: %v\n", targetDeploy.RepoURL, err)
			config.DB.Model(&targetDeploy).Updates(map[string]interface{}{
				"status":     "failed",
				"last_error": fmt.Sprintf("Auto-Deploy (Push by %s): %v", pusher, err),
			})
		} else {
			cleanNewID := newID
			if len(cleanNewID) > 12 {
				cleanNewID = cleanNewID[:12]
			}
			config.DB.Model(&targetDeploy).Updates(map[string]interface{}{
				"container_id": cleanNewID,
				"status":       "running",
				"last_error":   "",
				"updated_at":   time.Now(),
			})
			fmt.Printf("✅ [Auto-Deploy Success] %s ทำงานบน Container ID ใหม่: %s เรียบร้อยแล้ว!\n", targetDeploy.RepoURL, cleanNewID)
		}
	}(deploy, pusherName, commitMsg, branch)

	c.JSON(http.StatusOK, gin.H{
		"message":      "Auto-deployment triggered successfully!",
		"service_name": deploy.RepoURL,
		"branch":       branch,
		"pusher":       pusherName,
		"commit":       commitMsg,
	})
}

// HandleGlobalGitHubWebhook รับ Webhook กลาง แล้วค้นหา Service ที่จับคู่กับ Repo URL
// Route: POST /api/webhooks/github
func HandleGlobalGitHubWebhook(c *gin.Context) {
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read body"})
		return
	}

	eventType := c.GetHeader("X-GitHub-Event")
	if eventType == "ping" {
		c.JSON(http.StatusOK, gin.H{"message": "Pong! Global GitHub Webhook is ready."})
		return
	}

	rawJSON := extractWebhookJSON(c, bodyBytes)
	var payload GitHubWebhookPayload
	if err := json.Unmarshal(rawJSON, &payload); err != nil {
		fmt.Printf("⚠️ [Global Webhook Unmarshal Error]: %v | Raw: %s\n", err, string(bodyBytes))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON payload: " + err.Error()})
		return
	}

	repoHTML := strings.TrimSuffix(strings.ToLower(payload.Repository.HTMLURL), ".git")
	repoClone := strings.TrimSuffix(strings.ToLower(payload.Repository.CloneURL), ".git")

	var deployments []models.Deployment
	config.DB.Where("status != ?", "deleted").Find(&deployments)

	var matchedDeploys []models.Deployment
	for _, d := range deployments {
		cleanURL := strings.ToLower(d.RepoURL)
		cleanURL = strings.TrimSuffix(cleanURL, " (backend)")
		cleanURL = strings.TrimSuffix(cleanURL, " (frontend)")
		cleanURL = strings.TrimSuffix(cleanURL, ".git")

		if cleanURL == repoHTML || cleanURL == repoClone || strings.Contains(repoHTML, cleanURL) || strings.Contains(cleanURL, repoHTML) {
			matchedDeploys = append(matchedDeploys, d)
		}
	}

	if len(matchedDeploys) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"message": "No matching active service found for repository: " + payload.Repository.HTMLURL,
		})
		return
	}

	sigHeader := c.GetHeader("X-Hub-Signature-256")
	if sigHeader != "" {
		validSig := false
		for _, dep := range matchedDeploys {
			if dep.WebhookSecret == "" || VerifySignature(dep.WebhookSecret, bodyBytes, sigHeader) {
				validSig = true
				break
			}
		}
		if !validSig {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid Webhook Secret Signature"})
			return
		}
	}

	triggeredNames := []string{}
	for _, dep := range matchedDeploys {
		triggeredNames = append(triggeredNames, dep.RepoURL)
		config.DB.Model(&dep).Update("status", "redeploying")

		go func(target models.Deployment) {
			ctx := context.Background()
			newID, err := services.RedeployApp(
				ctx,
				target.ContainerID,
				target.RepoURL,
				target.ImageName,
				target.ForceAI,
				target.GitToken,
			)
			if err != nil {
				fmt.Printf("❌ [Auto-Deploy Error] %s: %v\n", target.RepoURL, err)
				config.DB.Model(&target).Updates(map[string]interface{}{
					"status":     "failed",
					"last_error": fmt.Sprintf("Auto-Deploy Error: %v", err),
				})
			} else if len(newID) > 0 {
				cleanID := newID
				if len(cleanID) > 12 {
					cleanID = cleanID[:12]
				}
				config.DB.Model(&target).Updates(map[string]interface{}{
					"container_id": cleanID,
					"status":       "running",
					"last_error":   "",
					"updated_at":   time.Now(),
				})
			}
		}(dep)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   fmt.Sprintf("Auto-deployment triggered for %d service(s)", len(triggeredNames)),
		"triggered": triggeredNames,
	})
}
