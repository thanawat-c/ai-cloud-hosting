package controllers

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"ai-cloud-api/config"
	"ai-cloud-api/models"
	"ai-cloud-api/services"
	"ai-cloud-api/utils"

	"github.com/gin-gonic/gin"
)

// UpdateContainerDomain updates the custom domain and SSL TLS configuration of a container
func UpdateContainerDomain(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		CustomDomain     string `json:"custom_domain"`
		SSLEnabled       bool   `json:"ssl_enabled"`
		SSLForceRedirect bool   `json:"ssl_force_redirect"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
		return
	}

	cleanDomain := strings.TrimSpace(req.CustomDomain)
	cleanDomain = strings.TrimPrefix(cleanDomain, "http://")
	cleanDomain = strings.TrimPrefix(cleanDomain, "https://")
	cleanDomain = strings.TrimSuffix(cleanDomain, "/")

	var deploy models.Deployment
	if err := config.DB.Where("container_id LIKE ?", id+"%").First(&deploy).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Deployment not found"})
		return
	}

	sslStatus := "inactive"
	sslEnabled := req.SSLEnabled
	if cleanDomain != "" {
		if strings.HasSuffix(cleanDomain, ".localhost") {
			sslStatus = "local"
			sslEnabled = true
		} else if req.SSLEnabled {
			sslStatus = "active"
		}
	} else {
		sslEnabled = false
	}

	config.DB.Model(&deploy).Updates(map[string]interface{}{
		"custom_domain":       cleanDomain,
		"ssl_enabled":         sslEnabled,
		"ssl_status":          sslStatus,
		"ssl_force_redirect":  req.SSLForceRedirect,
	})

	newID := deploy.ContainerID
	if deploy.ContainerID != "" {
		updatedID, err := services.UpdateContainerCustomDomain(context.Background(), deploy.ContainerID, cleanDomain, sslEnabled)
		if err == nil && updatedID != "" {
			newID = updatedID
			cleanID := updatedID
			if len(cleanID) > 12 {
				cleanID = cleanID[:12]
			}
			config.DB.Model(&deploy).Updates(map[string]interface{}{
				"container_id": cleanID,
				"status":       "running",
			})
		}
	}

	cleanID := newID
	if len(cleanID) > 12 {
		cleanID = cleanID[:12]
	}

	wsID := deploy.WorkspaceID
	if wsID == "" {
		wsID = utils.GetWorkspaceID(c)
	}
	serviceName := getDeploymentDisplayName(deploy, id)
	if cleanDomain != "" {
		sslDesc := "with SSL disabled"
		if sslEnabled {
			sslDesc = "with Auto SSL (Let's Encrypt / TLS) enabled"
		}
		utils.CreateNotification(wsID, "Custom Domain Attached", fmt.Sprintf("Domain '%s' was attached to service '%s' %s", cleanDomain, serviceName, sslDesc), "info", serviceName)
	} else {
		utils.CreateNotification(wsID, "Custom Domain Removed", fmt.Sprintf("Custom domain removed from service '%s'", serviceName), "info", serviceName)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":            "Custom domain & SSL updated successfully",
		"custom_domain":      cleanDomain,
		"ssl_enabled":        sslEnabled,
		"ssl_status":         sslStatus,
		"ssl_force_redirect": req.SSLForceRedirect,
		"new_id":             cleanID,
	})
}
