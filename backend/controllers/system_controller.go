package controllers

import (
	"context"
	"fmt"
	"net/http"

	"ai-cloud-api/services"
	"ai-cloud-api/utils"

	"github.com/gin-gonic/gin"
)

// GetSystemHealth returns real host CPU, RAM, Disk, and Docker metrics
func GetSystemHealth(c *gin.Context) {
	health, err := services.GetHostHealth(context.Background())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to collect host metrics: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, health)
}

// PruneDockerSystem performs comprehensive cleanup of Docker disk space
func PruneDockerSystem(c *gin.Context) {
	res, err := services.PruneDockerSystem(context.Background())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to prune docker system: " + err.Error()})
		return
	}

	wsID := utils.GetWorkspaceID(c)
	utils.CreateNotification(wsID, "Docker Pruned", fmt.Sprintf("Reclaimed %.1f MB of disk space", res["space_reclaimed_mb"]), "success", "Host System")

	c.JSON(http.StatusOK, gin.H{
		"message": "Docker system pruned successfully",
		"result":  res,
	})
}
