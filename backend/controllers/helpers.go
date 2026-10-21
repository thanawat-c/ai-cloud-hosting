package controllers

import (
	"strconv"
	"strings"

	"ai-cloud-api/config"
	"ai-cloud-api/models"
)

// findDeployment finds a deployment record by numeric ID or container ID prefix
func findDeployment(id string) models.Deployment {
	var dep models.Deployment
	if uintID, err := strconv.ParseUint(id, 10, 64); err == nil {
		config.DB.Where("id = ? OR container_id = ?", uintID, id).First(&dep)
	} else {
		config.DB.Where("container_id LIKE ?", id+"%").First(&dep)
	}
	return dep
}

// getDeploymentDisplayName extracts a clean display name for notifications and logs
func getDeploymentDisplayName(dep models.Deployment, fallback string) string {
	if dep.RepoURL != "" {
		clean := strings.TrimSuffix(dep.RepoURL, ".git")
		parts := strings.Split(clean, "/")
		if len(parts) > 0 {
			return parts[len(parts)-1]
		}
	}
	if dep.ImageName != "" {
		return dep.ImageName
	}
	return fallback
}
