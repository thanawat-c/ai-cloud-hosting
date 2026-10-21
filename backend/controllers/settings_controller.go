package controllers

import (
	"fmt"
	"net/http"

	"ai-cloud-api/config"
	"ai-cloud-api/models"
	"ai-cloud-api/utils"

	"github.com/gin-gonic/gin"
)

// GetContainerSettings returns build and project configuration for a service
func GetContainerSettings(c *gin.Context) {
	id := c.Param("id")
	dep := findDeployment(id)
	if dep.ID == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Deployment not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":           dep.ID,
		"container_id": dep.ContainerID,
		"repo_url":     dep.RepoURL,
		"branch":       dep.Branch,
		"root_dir":     dep.RootDir,
		"build_cmd":    dep.BuildCmd,
		"install_cmd":  dep.InstallCmd,
		"start_cmd":    dep.StartCmd,
		"output_dir":   dep.OutputDir,
		"node_version": dep.NodeVersion,
		"auto_deploy":  dep.AutoDeploy,
	})
}

// UpdateContainerSettings saves build configuration and root directory
func UpdateContainerSettings(c *gin.Context) {
	id := c.Param("id")
	dep := findDeployment(id)
	if dep.ID == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Deployment not found"})
		return
	}

	var req models.UpdateProjectSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	updates := map[string]interface{}{
		"root_dir":     req.RootDir,
		"build_cmd":    req.BuildCmd,
		"install_cmd":  req.InstallCmd,
		"start_cmd":    req.StartCmd,
		"output_dir":   req.OutputDir,
		"node_version": req.NodeVersion,
	}
	if req.AutoDeploy != nil {
		updates["auto_deploy"] = *req.AutoDeploy
	}

	if err := config.DB.Model(&dep).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update project settings: " + err.Error()})
		return
	}

	wsID := dep.WorkspaceID
	if wsID == "" {
		wsID = utils.GetWorkspaceID(c)
	}
	serviceName := getDeploymentDisplayName(dep, id)
	utils.CreateNotification(wsID, "Project Settings Updated", fmt.Sprintf("Build settings updated for '%s'", serviceName), "info", serviceName)

	c.JSON(http.StatusOK, gin.H{
		"message": "Project settings updated successfully",
		"settings": gin.H{
			"root_dir":     req.RootDir,
			"build_cmd":    req.BuildCmd,
			"install_cmd":  req.InstallCmd,
			"start_cmd":    req.StartCmd,
			"output_dir":   req.OutputDir,
			"node_version": req.NodeVersion,
			"auto_deploy":  dep.AutoDeploy,
		},
	})
}
