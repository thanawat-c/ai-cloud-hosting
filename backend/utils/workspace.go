package utils

import (
	"strings"

	"github.com/gin-gonic/gin"
)

// GetWorkspaceID extracts the active workspace ID from the request header, query, or defaults to "personal"
func GetWorkspaceID(c *gin.Context) string {
	// 1. Try header
	if ws := strings.TrimSpace(c.GetHeader("X-Workspace-Id")); ws != "" {
		return strings.ToLower(ws)
	}

	// 2. Try query parameter
	if ws := strings.TrimSpace(c.Query("workspace_id")); ws != "" {
		return strings.ToLower(ws)
	}

	// 3. Default to personal
	return "personal"
}
