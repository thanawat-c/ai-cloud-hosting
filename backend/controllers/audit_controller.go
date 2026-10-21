package controllers

import (
	"net/http"
	"strconv"
	"strings"

	"ai-cloud-api/config"
	"ai-cloud-api/models"
	"ai-cloud-api/utils"

	"github.com/gin-gonic/gin"
)

// GetAuditLogs returns chronological activity logs with optional filtering
func GetAuditLogs(c *gin.Context) {
	wsID := utils.GetWorkspaceID(c)

	query := config.DB.Where("workspace_id = ?", wsID)

	// Filter by resource type if specified (e.g. deployment, database, volume, member)
	if resType := strings.TrimSpace(c.Query("type")); resType != "" && resType != "all" {
		query = query.Where("resource_type = ?", resType)
	}

	limit := 50
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}

	var logs []models.AuditLog
	query.Order("created_at desc").Limit(limit).Find(&logs)

	c.JSON(http.StatusOK, logs)
}
