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

// AlertStyle defines standard presentation styles (color, label, icon) for alerts.
type AlertStyle struct {
	Color       int
	StatusLabel string
	IconURL     string
}

// Global alert styling map with CDN-hosted high-resolution icons
var alertStyles = map[string]AlertStyle{
	"success": {
		Color:       0x10b981, // Emerald Green
		StatusLabel: "SUCCESS",
		IconURL:     "https://img.icons8.com/color/96/ok--v1.png",
	},
	"error": {
		Color:       0xef4444, // Red
		StatusLabel: "FAILED",
		IconURL:     "https://img.icons8.com/color/96/cancel--v1.png",
	},
	"warning": {
		Color:       0xf59e0b, // Amber
		StatusLabel: "WARNING",
		IconURL:     "https://img.icons8.com/color/96/warning-shield.png",
	},
	"info": {
		Color:       0x3b82f6, // Blue
		StatusLabel: "INFO",
		IconURL:     "https://img.icons8.com/color/96/info--v1.png",
	},
}

// getBrandConfig retrieves branding options from environment variables or returns defaults.
func getBrandConfig() (string, string) {
	brandName := os.Getenv("ACH_BRAND_NAME")
	if brandName == "" {
		brandName = "AI Cloud Hosting"
	}
	brandIcon := os.Getenv("ACH_BRAND_ICON_URL")
	if brandIcon == "" {
		brandIcon = "https://img.icons8.com/color/96/cloud.png"
	}
	return brandName, brandIcon
}

// getDashboardURL retrieves the dashboard frontend URL from environment variables or defaults to localhost:5173.
func getDashboardURL() string {
	if url := os.Getenv("DASHBOARD_URL"); url != "" {
		return strings.TrimRight(url, "/")
	}
	if url := os.Getenv("FRONTEND_URL"); url != "" {
		return strings.TrimRight(url, "/")
	}
	if url := os.Getenv("APP_URL"); url != "" {
		return strings.TrimRight(url, "/")
	}
	return "http://localhost:5173"
}

// DispatchWebhooks dispatches notifications to all active webhooks in the workspace asynchronously.
func DispatchWebhooks(workspaceID, title, message, notifType, resourceName string) {
	if config.DB == nil {
		return
	}
	if workspaceID == "" {
		workspaceID = "personal"
	}

	// Run non-blocking in a background goroutine to avoid delaying API responses
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

// SendWebhookDirect delivers a test notification to a specific webhook endpoint synchronously.
func SendWebhookDirect(wh models.WebhookAlert, title, message, notifType, resourceName string) error {
	return sendWebhookNotification(wh, title, message, notifType, resourceName, wh.WorkspaceID)
}

func sendWebhookNotification(wh models.WebhookAlert, title, message, notifType, resourceName, wsID string) error {
	client := &http.Client{Timeout: 8 * time.Second}
	var payload []byte
	var err error

	brandName, brandIcon := getBrandConfig()

	// Resolve alert style based on event severity
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
					"url":         getDashboardURL(),
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
