package controllers

import (
	"net/http"

	"ai-cloud-api/config"
	"ai-cloud-api/models"
	"ai-cloud-api/utils"

	"github.com/gin-gonic/gin"
)

// GetNotifications retrieves all notifications for the active workspace.
func GetNotifications(c *gin.Context) {
	wsID := utils.GetWorkspaceID(c)

	var notifications []models.Notification
	config.DB.Where("workspace_id = ?", wsID).Order("created_at desc").Limit(50).Find(&notifications)

	var unreadCount int64
	config.DB.Model(&models.Notification{}).Where("workspace_id = ? AND is_read = false", wsID).Count(&unreadCount)

	c.JSON(http.StatusOK, gin.H{
		"notifications": notifications,
		"unread_count":  unreadCount,
	})
}

// MarkAllNotificationsRead marks all unread notifications in the workspace as read.
func MarkAllNotificationsRead(c *gin.Context) {
	wsID := utils.GetWorkspaceID(c)

	config.DB.Model(&models.Notification{}).
		Where("workspace_id = ? AND is_read = false", wsID).
		Update("is_read", true)

	c.JSON(http.StatusOK, gin.H{"message": "Marked all notifications as read"})
}

// ClearNotifications removes all notifications for the active workspace.
func ClearNotifications(c *gin.Context) {
	wsID := utils.GetWorkspaceID(c)

	config.DB.Where("workspace_id = ?", wsID).Delete(&models.Notification{})

	c.JSON(http.StatusOK, gin.H{"message": "Notifications cleared successfully"})
}
