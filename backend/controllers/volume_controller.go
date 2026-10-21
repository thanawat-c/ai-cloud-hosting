package controllers

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"ai-cloud-api/config"
	"ai-cloud-api/models"
	"ai-cloud-api/utils"

	"github.com/docker/docker/api/types/volume"
	"github.com/docker/docker/client"
	"github.com/gin-gonic/gin"
)

// GetVolumes returns all persistent volumes for the active workspace
func GetVolumes(c *gin.Context) {
	wsID := utils.GetWorkspaceID(c)

	var volumes []models.Volume
	config.DB.Where("workspace_id = ?", wsID).Order("created_at desc").Find(&volumes)

	// Enrich with container display name if attached
	for i, v := range volumes {
		if v.ContainerID != "" && v.ServiceName == "" {
			dep := findDeployment(v.ContainerID)
			if dep.ID != 0 {
				volumes[i].ServiceName = getDeploymentDisplayName(dep, v.ContainerID)
			}
		}
	}

	c.JSON(http.StatusOK, volumes)
}

// CreateVolume provisions a new persistent Docker volume
func CreateVolume(c *gin.Context) {
	wsID := utils.GetWorkspaceID(c)

	var req models.CreateVolumeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please provide a volume name and mount path"})
		return
	}

	cleanName := strings.TrimSpace(req.Name)
	if cleanName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Volume name cannot be empty"})
		return
	}

	mountPath := strings.TrimSpace(req.MountPath)
	if mountPath == "" {
		mountPath = "/app/uploads"
	}
	if !strings.HasPrefix(mountPath, "/") {
		mountPath = "/" + mountPath
	}

	// Generate safe Docker volume name
	slug := regexp.MustCompile(`[^a-zA-Z0-9-]`).ReplaceAllString(strings.ToLower(cleanName), "-")
	dockerVolumeName := fmt.Sprintf("ach-vol-%s-%s-%d", wsID, slug, time.Now().Unix()%10000)

	// Create volume in Docker engine
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Docker connection failed: " + err.Error()})
		return
	}
	defer cli.Close()

	_, err = cli.VolumeCreate(context.Background(), volume.CreateOptions{
		Name: dockerVolumeName,
		Labels: map[string]string{
			"ach.workspace": wsID,
			"ach.type":      "volume",
			"ach.name":      cleanName,
		},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create Docker volume: " + err.Error()})
		return
	}

	serviceName := ""
	status := "available"
	if req.ContainerID != "" {
		status = "mounted"
		dep := findDeployment(req.ContainerID)
		if dep.ID != 0 {
			serviceName = getDeploymentDisplayName(dep, req.ContainerID)
		}
	}

	newVol := models.Volume{
		WorkspaceID: wsID,
		Name:        cleanName,
		VolumeName:  dockerVolumeName,
		MountPath:   mountPath,
		ContainerID: req.ContainerID,
		ServiceName: serviceName,
		Driver:      "local",
		Status:      status,
	}

	if err := config.DB.Create(&newVol).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record volume: " + err.Error()})
		return
	}

	utils.CreateNotification(wsID, "Volume Created", fmt.Sprintf("Volume '%s' created (Mount: %s)", cleanName, mountPath), "success", cleanName)

	c.JSON(http.StatusCreated, gin.H{
		"message": "Volume created successfully",
		"volume":  newVol,
	})
}

// AttachVolume attaches an existing volume to a container
func AttachVolume(c *gin.Context) {
	wsID := utils.GetWorkspaceID(c)
	volID := c.Param("id")

	var vol models.Volume
	if err := config.DB.Where("id = ? AND workspace_id = ?", volID, wsID).First(&vol).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Volume not found"})
		return
	}

	var req models.AttachVolumeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Container ID is required"})
		return
	}

	dep := findDeployment(req.ContainerID)
	serviceName := getDeploymentDisplayName(dep, req.ContainerID)

	updates := map[string]interface{}{
		"container_id": req.ContainerID,
		"service_name": serviceName,
		"status":       "mounted",
	}
	if req.MountPath != "" {
		cleanMount := strings.TrimSpace(req.MountPath)
		if !strings.HasPrefix(cleanMount, "/") {
			cleanMount = "/" + cleanMount
		}
		updates["mount_path"] = cleanMount
		vol.MountPath = cleanMount
	}

	config.DB.Model(&vol).Updates(updates)
	vol.ContainerID = req.ContainerID
	vol.ServiceName = serviceName
	vol.Status = "mounted"

	utils.CreateNotification(wsID, "Volume Attached", fmt.Sprintf("Volume '%s' attached to %s", vol.Name, serviceName), "info", vol.Name)

	c.JSON(http.StatusOK, gin.H{
		"message": "Volume attached successfully",
		"volume":  vol,
	})
}

// DetachVolume detaches a volume from its container
func DetachVolume(c *gin.Context) {
	wsID := utils.GetWorkspaceID(c)
	volID := c.Param("id")

	var vol models.Volume
	if err := config.DB.Where("id = ? AND workspace_id = ?", volID, wsID).First(&vol).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Volume not found"})
		return
	}

	config.DB.Model(&vol).Updates(map[string]interface{}{
		"container_id": "",
		"service_name": "",
		"status":       "available",
	})

	utils.CreateNotification(wsID, "Volume Detached", fmt.Sprintf("Volume '%s' is now unmounted", vol.Name), "info", vol.Name)

	c.JSON(http.StatusOK, gin.H{"message": "Volume detached successfully"})
}

// DeleteVolume removes a volume from Docker and database
func DeleteVolume(c *gin.Context) {
	wsID := utils.GetWorkspaceID(c)
	volID := c.Param("id")

	var vol models.Volume
	if err := config.DB.Where("id = ? AND workspace_id = ?", volID, wsID).First(&vol).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Volume not found"})
		return
	}

	// Remove from Docker engine
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err == nil {
		_ = cli.VolumeRemove(context.Background(), vol.VolumeName, true)
		cli.Close()
	}

	config.DB.Delete(&vol)

	utils.CreateNotification(wsID, "Volume Deleted", fmt.Sprintf("Volume '%s' was deleted", vol.Name), "warning", vol.Name)

	c.JSON(http.StatusOK, gin.H{"message": "Volume deleted successfully"})
}
