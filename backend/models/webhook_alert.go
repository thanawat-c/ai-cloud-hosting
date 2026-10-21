package models

import (
	"time"
)

// WebhookAlert stores configuration for external notifications (Discord, Slack, Custom Webhooks).
type WebhookAlert struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	WorkspaceID string    `gorm:"index" json:"workspace_id"`
	Name        string    `json:"name"`     // e.g. "Dev Alerts Discord"
	URL         string    `json:"url"`      // Webhook URL
	Platform    string    `json:"platform"` // "discord", "slack", "generic"
	Events      string    `json:"events"`   // "all", "deploy", "database", "system"
	IsActive    bool      `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
