package models

import "time"

// APIToken represents an API token for programmatic access via cURL or CI/CD pipelines.
type APIToken struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	WorkspaceID string     `gorm:"type:varchar(50);default:'personal';index" json:"workspace_id"`
	Name        string     `gorm:"type:varchar(100);not null" json:"name"`
	Token       string     `gorm:"type:varchar(255);uniqueIndex;not null" json:"token"` // Masked in general list queries
	MaskedToken string     `gorm:"-" json:"masked_token,omitempty"`
	LastUsedAt  *time.Time `json:"last_used_at"`
	CreatedAt   time.Time  `gorm:"autoCreateTime" json:"created_at"`
}
