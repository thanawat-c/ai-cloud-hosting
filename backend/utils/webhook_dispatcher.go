package utils

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"ai-cloud-api/config"
	"ai-cloud-api/models"
)

// AlertStyle กำหนดสีและไอคอนมาตรฐานสากลตามระดับความสำคัญ
type AlertStyle struct {
	Color       int
	StatusLabel string
	IconURL     string
}

// แผนผังไอคอนความละเอียดสูงแบบ CDN ไม่ hardcode อีโมจิ
var alertStyles = map[string]AlertStyle{
	"success": {
		Color:       0x10b981, // Emerald Green
		StatusLabel: "SUCCESS",
		IconURL:     "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/check-circle.png",
	},
	"error": {
		Color:       0xef4444, // Red
		StatusLabel: "FAILED",
		IconURL:     "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/alert-circle.png",
	},
	"warning": {
		Color:       0xf59e0b, // Amber
		StatusLabel: "WARNING",
		IconURL:     "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/alert-triangle.png",
	},
	"info": {
		Color:       0x3b82f6, // Blue
		StatusLabel: "INFO",
		IconURL:     "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/info.png",
	},
}

// getBrandConfig ดึงการตั้งค่าแบรนด์จาก Environment หรือใช้ค่าเริ่มต้นมาตรฐาน
func getBrandConfig() (string, string) {
	brandName := os.Getenv("ACH_BRAND_NAME")
	if brandName == "" {
		brandName = "AI Cloud Hosting"
	}
	brandIcon := os.Getenv("ACH_BRAND_ICON_URL")
	if brandIcon == "" {
		brandIcon = "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/cloud.png"
	}
	return brandName, brandIcon
}

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

	brandName, brandIcon := getBrandConfig()

	// เลือกลักษณะของ Alert ตามประเภทเหตุการณ์
	style, exists := alertStyles[strings.ToLower(notifType)]
	if !exists {
		style = alertStyles["info"]
	}

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
		fields := []map[string]interface{}{
			{
				"name":   "Status",
				"value":  fmt.Sprintf("`%s`", style.StatusLabel),
				"inline": true,
			},
		}

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
			"username":   brandName,
			"avatar_url": brandIcon,
			"embeds": []map[string]interface{}{
				{
					"author": map[string]interface{}{
						"name":     brandName,
						"icon_url": brandIcon,
					},
					"title":       title,
					"description": message,
					"color":       style.Color,
					"thumbnail": map[string]interface{}{
						"url": style.IconURL,
					},
					"fields": fields,
					"footer": map[string]interface{}{
						"text":     fmt.Sprintf("%s Alerts System", brandName),
						"icon_url": brandIcon,
					},
					"timestamp": time.Now().UTC().Format(time.RFC3339),
				},
			},
		}
		payload, err = json.Marshal(discordBody)

	case "slack":
		slackBody := map[string]interface{}{
			"blocks": []map[string]interface{}{
				{
					"type": "header",
					"text": map[string]interface{}{
						"type":  "plain_text",
						"text":  title,
						"emoji": true,
					},
				},
				{
					"type": "section",
					"text": map[string]interface{}{
						"type": "mrkdwn",
						"text": message,
					},
					"accessory": map[string]interface{}{
						"type":      "image",
						"image_url": style.IconURL,
						"alt_text":  style.StatusLabel,
					},
				},
				{
					"type": "context",
					"elements": []map[string]interface{}{
						{
							"type": "mrkdwn",
							"text": fmt.Sprintf("*Status:* `%s` | *Resource:* `%s` | *Workspace:* `%s`", style.StatusLabel, resourceName, wsID),
						},
					},
				},
			},
		}
		payload, err = json.Marshal(slackBody)

	default: // Generic JSON Webhook
		genericBody := map[string]interface{}{
			"event":        "alert",
			"title":        title,
			"message":      message,
			"status":       style.StatusLabel,
			"type":         notifType,
			"resource":     resourceName,
			"workspace_id": wsID,
			"icon_url":     style.IconURL,
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
	req.Header.Set("User-Agent", fmt.Sprintf("%s-Alerts/1.0", strings.ReplaceAll(brandName, " ", "-")))

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
