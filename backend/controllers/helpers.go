package controllers

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"ai-cloud-api/config"
	"ai-cloud-api/models"

	"github.com/gin-gonic/gin"
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

// GetPublicAPIBase dynamically resolves the base API URL using env vars, request headers, or default port
func GetPublicAPIBase(c *gin.Context) string {
	if envURL := os.Getenv("PUBLIC_API_URL"); envURL != "" {
		return strings.TrimRight(envURL, "/")
	}
	if envURL := os.Getenv("API_URL"); envURL != "" {
		return strings.TrimRight(envURL, "/")
	}

	if c != nil && c.Request != nil {
		scheme := "http"
		if c.Request.TLS != nil || c.GetHeader("X-Forwarded-Proto") == "https" {
			scheme = "https"
		}
		host := c.GetHeader("X-Forwarded-Host")
		if host == "" {
			host = c.Request.Host
		}
		if host != "" {
			return fmt.Sprintf("%s://%s/api", scheme, host)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	port = strings.TrimPrefix(port, ":")
	return fmt.Sprintf("http://localhost:%s/api", port)
}
