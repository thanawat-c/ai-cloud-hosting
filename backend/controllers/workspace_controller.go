package controllers

import (
	"net/http"
	"strings"

	"ai-cloud-api/config"
	"ai-cloud-api/models"

	"github.com/gin-gonic/gin"
)

// GetWorkspaces returns all workspaces along with service and database counts
func GetWorkspaces(c *gin.Context) {
	var workspaces []models.Workspace
	config.DB.Order("created_at asc").Find(&workspaces)

	var summaries []models.WorkspaceSummary
	for _, ws := range workspaces {
		var depCount int64
		config.DB.Model(&models.Deployment{}).
			Where("workspace_id = ? AND status != ? AND container_id != ''", ws.ID, "deleted").
			Count(&depCount)

		var dbCount int64
		config.DB.Model(&models.ManagedDatabase{}).
			Where("workspace_id = ? AND status != ?", ws.ID, "deleted").
			Count(&dbCount)

		var activeCount int64
		config.DB.Model(&models.Deployment{}).
			Where("workspace_id = ? AND status = ?", ws.ID, "running").
			Count(&activeCount)

		summaries = append(summaries, models.WorkspaceSummary{
			Workspace:        ws,
			DeploymentsCount: depCount,
			DatabasesCount:   dbCount,
			ActiveContainers: activeCount,
		})
	}

	c.JSON(http.StatusOK, summaries)
}

// CreateWorkspace creates a new workspace
func CreateWorkspace(c *gin.Context) {
	var req struct {
		Name        string `json:"name" binding:"required"`
		Type        string `json:"type"` // personal, team
		Color       string `json:"color"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body. Please provide a workspace name."})
		return
	}

	trimmedName := strings.TrimSpace(req.Name)
	if trimmedName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Workspace name cannot be empty"})
		return
	}

	slug := strings.ToLower(trimmedName)
	slug = strings.ReplaceAll(slug, " ", "-")

	wsType := req.Type
	if wsType == "" {
		wsType = "team"
	}
	color := req.Color
	if color == "" {
		color = "blue"
	}

	newWs := models.Workspace{
		ID:          slug,
		Name:        trimmedName,
		Slug:        slug,
		Type:        wsType,
		Plan:        "Pro",
		Color:       color,
		Description: req.Description,
	}

	if err := config.DB.Create(&newWs).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to create workspace (name may already exist): " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, newWs)
}
