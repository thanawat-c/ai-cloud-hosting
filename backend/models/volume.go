package models

import "time"

// Volume represents a persistent Docker storage volume attached to a container
type Volume struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	WorkspaceID string    `gorm:"type:varchar(50);index;not null" json:"workspace_id"`
	Name        string    `gorm:"type:varchar(100);not null" json:"name"`
	VolumeName  string    `gorm:"type:varchar(150);not null;unique" json:"volume_name"`
	MountPath   string    `gorm:"type:varchar(255);not null" json:"mount_path"` // e.g. /app/uploads
	ContainerID string    `gorm:"type:varchar(64)" json:"container_id"`
	ServiceName string    `gorm:"type:varchar(255)" json:"service_name"`
	Driver      string    `gorm:"default:'local'" json:"driver"`
	SizeInMB    int64     `gorm:"default:0" json:"size_in_mb"`
	Status      string    `gorm:"default:'available'" json:"status"` // available, mounted
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
}

type CreateVolumeRequest struct {
	Name        string `json:"name" binding:"required"`
	MountPath   string `json:"mount_path" binding:"required"`
	ContainerID string `json:"container_id"`
}

type AttachVolumeRequest struct {
	ContainerID string `json:"container_id" binding:"required"`
	MountPath   string `json:"mount_path"`
}
