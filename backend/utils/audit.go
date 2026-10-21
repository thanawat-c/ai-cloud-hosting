package utils

import (
	"strings"

	"ai-cloud-api/config"
	"ai-cloud-api/models"

	"github.com/gin-gonic/gin"
)

// LogActivity records an audit event into the database asynchronously
func LogActivity(c *gin.Context, wsID string, action string, resType string, resID string, resName string, details string) {
	if config.DB == nil {
		return
	}

	actorEmail := "system@aicloud.local"
	actorName := "System"
	ipAddr := "127.0.0.1"

	if c != nil {
		if email := c.GetString("user_email"); email != "" {
			actorEmail = email
		}
		if name := c.GetString("user_name"); name != "" {
			actorName = name
		}
		if ip := c.ClientIP(); ip != "" {
			ipAddr = ip
		}
		if wsID == "" {
			wsID = GetWorkspaceID(c)
		}
	}

	if wsID == "" {
		wsID = "personal"
	}

	go func() {
		entry := models.AuditLog{
			WorkspaceID:  strings.ToLower(wsID),
			ActorName:    actorName,
			ActorEmail:   actorEmail,
			Action:       action,
			ResourceType: resType,
			ResourceID:   resID,
			ResourceName: resName,
			Details:      details,
			IPAddress:    ipAddr,
		}
		config.DB.Create(&entry)
	}()
}
