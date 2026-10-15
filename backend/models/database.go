package models

import (
	"time"
)

type ManagedDatabase struct {
	ID            uint      `json:"id" gorm:"primaryKey"`
	Name          string    `json:"name" gorm:"not null"`
	Type          string    `json:"type" gorm:"default:'postgres'"` // postgres, mysql, redis
	Version       string    `json:"version" gorm:"default:'16'"`
	ContainerID   string    `json:"container_id"`
	ContainerName string    `json:"container_name"`
	InternalPort  int       `json:"internal_port"`
	HostPort      int       `json:"host_port"`
	Username      string    `json:"username"`
	Password      string    `json:"password"`
	DBName        string    `json:"dbname"`
	InternalURL   string    `json:"internal_url"`
	ExternalURL   string    `json:"external_url"`
	Status        string    `json:"status" gorm:"default:'running'"`
	VolumeName    string    `json:"volume_name"`
	MemoryLimitMB int       `json:"memory_limit_mb" gorm:"default:512"`
	StorageUsage  string    `json:"storage_usage"`
	CreatedAt     time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt     time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

type CreateDatabaseRequest struct {
	Name string `json:"name" binding:"required"`
	Type string `json:"type"` // postgres, mysql, redis
}
