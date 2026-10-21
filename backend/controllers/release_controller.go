package controllers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"ai-cloud-api/config"
	"ai-cloud-api/models"
	"ai-cloud-api/services"
	"ai-cloud-api/utils"

	"github.com/gin-gonic/gin"
)

// GetContainerReleases retrieves deployment release history for a service
func GetContainerReleases(c *gin.Context) {
	id := c.Param("id")
	deploy := findDeployment(id)
	if deploy.ID == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Deployment not found"})
		return
	}

	var releases []models.DeploymentRelease
	config.DB.Where("deployment_id = ?", deploy.ID).Order("created_at desc").Find(&releases)

	// If no releases exist yet, create initial release record from current state
	if len(releases) == 0 {
		cleanHash := deploy.CommitHash
		if cleanHash == "" && deploy.ContainerID != "" {
			if len(deploy.ContainerID) >= 7 {
				cleanHash = deploy.ContainerID[:7]
			} else {
				cleanHash = deploy.ContainerID
			}
		}
		initial := models.DeploymentRelease{
			DeploymentID:  deploy.ID,
			ContainerID:   deploy.ContainerID,
			ImageName:     deploy.ImageName,
			Branch:        deploy.Branch,
			CommitHash:    cleanHash,
			CommitMessage: deploy.CommitMessage,
			AuthorName:    deploy.AuthorName,
			AuthorAvatar:  deploy.AuthorAvatar,
			Status:        "success",
			IsActive:      true,
			CreatedAt:     deploy.CreatedAt,
		}
		if initial.Branch == "" {
			initial.Branch = "main"
		}
		if initial.AuthorName == "" {
			initial.AuthorName = "Developer"
		}
		config.DB.Create(&initial)
		releases = append(releases, initial)
	}

	c.JSON(http.StatusOK, releases)
}

// RollbackContainer switches the container back to a previous release with zero build time
func RollbackContainer(c *gin.Context) {
	id := c.Param("id")
	deploy := findDeployment(id)
	if deploy.ID == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Deployment not found"})
		return
	}

	var req struct {
		ReleaseID uint `json:"release_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please specify release_id to rollback"})
		return
	}

	var targetRelease models.DeploymentRelease
	if err := config.DB.Where("id = ? AND deployment_id = ?", req.ReleaseID, deploy.ID).First(&targetRelease).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Specified release not found"})
		return
	}

	ctx := context.Background()
	wsID := deploy.WorkspaceID
	if wsID == "" {
		wsID = utils.GetWorkspaceID(c)
	}

	newID, err := services.RollbackToImage(ctx, deploy.ContainerID, targetRelease.ImageName, wsID, deploy.CustomDomain, deploy.SSLEnabled)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Rollback failed: " + err.Error()})
		return
	}

	cleanID := newID
	if len(cleanID) > 12 {
		cleanID = cleanID[:12]
	}

	// Update main Deployment record
	config.DB.Model(&deploy).Updates(map[string]interface{}{
		"container_id":   cleanID,
		"status":         "running",
		"branch":         targetRelease.Branch,
		"commit_hash":    targetRelease.CommitHash,
		"commit_message": targetRelease.CommitMessage,
		"author_name":    targetRelease.AuthorName,
		"author_avatar":  targetRelease.AuthorAvatar,
		"last_error":     "",
		"updated_at":     time.Now(),
	})

	// Deactivate previous active release and activate target release
	config.DB.Model(&models.DeploymentRelease{}).Where("deployment_id = ?", deploy.ID).Update("is_active", false)
	config.DB.Model(&targetRelease).Updates(map[string]interface{}{
		"is_active":    true,
		"container_id": cleanID,
	})

	serviceName := getDeploymentDisplayName(deploy, id)
	commitTag := targetRelease.CommitHash
	if commitTag == "" {
		commitTag = targetRelease.Branch
	}
	utils.CreateNotification(wsID, "Deployment Rolled Back", fmt.Sprintf("Service '%s' was rolled back to release %s in 1 second", serviceName, commitTag), "warning", serviceName)

	c.JSON(http.StatusOK, gin.H{
		"message":        fmt.Sprintf("Rolled back to release successfully! Container restarted as %s", cleanID),
		"new_id":         cleanID,
		"active_release": targetRelease,
	})
}
