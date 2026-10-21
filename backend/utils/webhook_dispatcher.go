package utils

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"ai-cloud-api/config"
	"ai-cloud-api/models"
)

// DispatchWebhooks ยิงแจ้งเตือนไปยัง Webhooks ทั้งหมดที่ Active ใน Workspace แบบ Asynchronous
func DispatchWebhooks(workspaceID, title, message, notifType, resourceName string) {
	if config.DB == nil {
		return
	}
	if workspaceID == "" {
		workspaceID = "personal"
	}

	// รันแบบ Non-blocking ใน Goroutine แยก เพื่อไม่ให้กระทบเวลาตอบกลับของ API
	go func(wsID, t, msg, nType, res string) {
		var webhooks []models.WebhookAlert
		err := config.DB.Where("workspace_id = ? AND is_active = true", wsID).Find(&webhooks).Error
		if err != nil || len(webhooks) == 0 {
			return
		}

		for _, wh := range webhooks {
			go sendWebhookNotification(wh, t, msg, nType, res, wsID)
		}
	}(workspaceID, title, message, notifType, resourceName)
}

// SendWebhookDirect ยิงตรงสำหรับปุ่ม Test Webhook
func SendWebhookDirect(wh models.WebhookAlert, title, message, notifType, resourceName string) error {
	return sendWebhookNotification(wh, title, message, notifType, resourceName, wh.WorkspaceID)
}

func sendWebhookNotification(wh models.WebhookAlert, title, message, notifType, resourceName, wsID string) error {
	client := &http.Client{Timeout: 8 * time.Second}
	var payload []byte
	var err error

	platform := strings.ToLower(wh.Platform)
	if platform == "" {
		if strings.Contains(wh.URL, "discord.com") {
			platform = "discord"
		} else if strings.Contains(wh.URL, "slack.com") {
			platform = "slack"
		} else {
			platform = "generic"
		}
	}

	switch platform {
	case "discord":
		// Discord Embed Colors: Green = 3066993, Red = 15158332, Orange = 15105570, Blue = 3447003
		color := 3447003
		iconEmoji := "ℹ️"
		switch notifType {
		case "success":
			color = 3066993 // 0x2ecc71
			iconEmoji = "✅"
		case "error":
			color = 15158332 // 0xe74c3c
			iconEmoji = "🚨"
		case "warning":
			color = 15105570 // 0xe67e22
			iconEmoji = "⚠️"
		}

		fields := []map[string]interface{}{}
		if resourceName != "" {
			fields = append(fields, map[string]interface{}{
				"name":   "Resource",
				"value":  fmt.Sprintf("`%s`", resourceName),
				"inline": true,
			})
		}
		fields = append(fields, map[string]interface{}{
			"name":   "Workspace",
			"value":  fmt.Sprintf("`%s`", wsID),
			"inline": true,
		})

		discordBody := map[string]interface{}{
			"username":   "AI Cloud Hosting",
			"avatar_url": "https://cdn-icons-png.flaticon.com/512/860/860882.png",
			"embeds": []map[string]interface{}{
				{
					"title":       fmt.Sprintf("%s %s", iconEmoji, title),
					"description": message,
					"color":       color,
					"fields":      fields,
					"footer": map[string]interface{}{
						"text": "AI Cloud Hosting • Alerts System",
					},
					"timestamp": time.Now().UTC().Format(time.RFC3339),
				},
			},
		}
		payload, err = json.Marshal(discordBody)

	case "slack":
		slackBody := map[string]interface{}{
			"text": fmt.Sprintf("*[%s]* %s\n*Resource:* `%s` | *Workspace:* `%s`", title, message, resourceName, wsID),
		}
		payload, err = json.Marshal(slackBody)

	default: // Generic JSON Webhook
		genericBody := map[string]interface{}{
			"event":        "alert",
			"title":        title,
			"message":      message,
			"type":         notifType,
			"resource":     resourceName,
			"workspace_id": wsID,
			"timestamp":    time.Now().UTC().Format(time.RFC3339),
		}
		payload, err = json.Marshal(genericBody)
	}

	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", wh.URL, bytes.NewBuffer(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "AI-Cloud-Hosting-Alerts/1.0")

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("webhook responded with HTTP %d", resp.StatusCode)
	}

	return nil
}
