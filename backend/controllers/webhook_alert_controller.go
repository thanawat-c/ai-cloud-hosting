package controllers

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"ai-cloud-api/config"
	"ai-cloud-api/models"
	"ai-cloud-api/utils"

	"github.com/gin-gonic/gin"
)

// GetWebhookAlerts retrieves all webhook configurations for a workspace.
func GetWebhookAlerts(c *gin.Context) {
	wsID := c.Query("workspace_id")
	if wsID == "" {
		wsID = "personal"
	}

	var webhooks []models.WebhookAlert
	if err := config.DB.Where("workspace_id = ?", wsID).Order("created_at desc").Find(&webhooks).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch webhooks"})
		return
	}

	c.JSON(http.StatusOK, webhooks)
}

// CreateWebhookAlert registers a new webhook alert endpoint.
func CreateWebhookAlert(c *gin.Context) {
	wsID := c.Query("workspace_id")
	if wsID == "" {
		wsID = "personal"
	}

	var req struct {
		Name     string `json:"name" binding:"required"`
		URL      string `json:"url" binding:"required"`
		Platform string `json:"platform"`
		Events   string `json:"events"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Name and Webhook URL are required"})
		return
	}

	// Validate URL
	parsedURL, err := url.ParseRequestURI(req.URL)
	if err != nil || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Webhook URL format (must start with http:// or https://)"})
		return
	}

	platform := req.Platform
	if platform == "" {
		if strings.Contains(req.URL, "discord.com") {
			platform = "discord"
		} else if strings.Contains(req.URL, "slack.com") {
			platform = "slack"
		} else {
			platform = "generic"
		}
	}

	events := req.Events
	if events == "" {
		events = "all"
	}

	wh := models.WebhookAlert{
		ID:          fmt.Sprintf("wh-%d", time.Now().UnixNano()),
		WorkspaceID: wsID,
		Name:        strings.TrimSpace(req.Name),
		URL:         strings.TrimSpace(req.URL),
		Platform:    platform,
		Events:      events,
		IsActive:    true,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := config.DB.Create(&wh).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save webhook"})
		return
	}

	utils.LogActivity(c, wsID, "CREATE_WEBHOOK", "webhook", wh.ID, wh.Name, fmt.Sprintf("Created %s webhook alert", wh.Platform))

	c.JSON(http.StatusCreated, wh)
}

// ToggleWebhookAlert toggles the active state of a webhook.
func ToggleWebhookAlert(c *gin.Context) {
	id := c.Param("id")
	var wh models.WebhookAlert

	if err := config.DB.First(&wh, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Webhook not found"})
		return
	}

	wh.IsActive = !wh.IsActive
	wh.UpdatedAt = time.Now()
	config.DB.Save(&wh)

	utils.LogActivity(c, wh.WorkspaceID, "TOGGLE_WEBHOOK", "webhook", wh.ID, wh.Name, fmt.Sprintf("Webhook active state changed to %v", wh.IsActive))

	c.JSON(http.StatusOK, gin.H{
		"message":   "Webhook status updated",
		"is_active": wh.IsActive,
	})
}

// DeleteWebhookAlert removes a webhook configuration.
func DeleteWebhookAlert(c *gin.Context) {
	id := c.Param("id")
	var wh models.WebhookAlert

	if err := config.DB.First(&wh, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Webhook not found"})
		return
	}

	config.DB.Delete(&wh)

	utils.LogActivity(c, wh.WorkspaceID, "DELETE_WEBHOOK", "webhook", wh.ID, wh.Name, "Deleted webhook alert")

	c.JSON(http.StatusOK, gin.H{"message": "Webhook deleted successfully"})
}

// TestWebhookAlert sends a test message to verify the webhook destination.
func TestWebhookAlert(c *gin.Context) {
	id := c.Param("id")
	var wh models.WebhookAlert

	if err := config.DB.First(&wh, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Webhook not found"})
		return
	}

	testTitle := "Webhook Integration Verified"
	testMsg := fmt.Sprintf("Your %s outgoing alert webhook has been successfully verified for workspace '%s'.", strings.ToUpper(wh.Platform), wh.WorkspaceID)

	if err := utils.SendWebhookDirect(wh, testTitle, testMsg, "success", "system-test"); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Failed to send test alert: %s", err.Error()),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Test alert successfully delivered to %s!", wh.Platform),
	})
}
