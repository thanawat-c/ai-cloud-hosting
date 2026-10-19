package utils

import (
	"ai-cloud-api/config"
	"ai-cloud-api/models"
)

// CreateNotification บันทึกการแจ้งเตือนเหตุการณ์ระบบลงฐานข้อมูล
func CreateNotification(workspaceID, title, message, notifType, resourceName string) {
	if config.DB == nil {
		return
	}
	if workspaceID == "" {
		workspaceID = "personal"
	}
	notif := models.Notification{
		WorkspaceID:  workspaceID,
		Title:        title,
		Message:      message,
		Type:         notifType,
		ResourceName: resourceName,
		IsRead:       false,
	}
	config.DB.Create(&notif)
}
