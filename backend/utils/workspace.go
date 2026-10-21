package utils

import (
	"strings"
	"time"

	"ai-cloud-api/config"
	"ai-cloud-api/models"

	"github.com/gin-gonic/gin"
)

// GetWorkspaceID extracts the active workspace ID from Authorization Bearer token, header, query, or defaults to "personal"
func GetWorkspaceID(c *gin.Context) string {
	// 1. Try Authorization: Bearer <API_TOKEN>
	authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		rawToken := strings.TrimSpace(authHeader[7:])
		if rawToken != "" && config.DB != nil {
			var apiToken models.APIToken
			if err := config.DB.Where("token = ?", rawToken).First(&apiToken).Error; err == nil && apiToken.WorkspaceID != "" {
				now := time.Now()
				config.DB.Model(&apiToken).Update("last_used_at", &now)
				c.Set("api_token_id", apiToken.ID)
				c.Set("api_token_name", apiToken.Name)
				return strings.ToLower(apiToken.WorkspaceID)
			}
		}
	}

	// 2. Try header
	if ws := strings.TrimSpace(c.GetHeader("X-Workspace-Id")); ws != "" {
		return strings.ToLower(ws)
	}

	// 3. Try query parameter
	if ws := strings.TrimSpace(c.Query("workspace_id")); ws != "" {
		return strings.ToLower(ws)
	}

	// 4. Default to personal
	return "personal"
}

