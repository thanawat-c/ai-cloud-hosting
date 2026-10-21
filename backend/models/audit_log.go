package models

import "time"

// AuditLog represents a persistent chronological record of user and system actions
type AuditLog struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	WorkspaceID  string    `gorm:"type:varchar(50);index;not null" json:"workspace_id"`
	ActorName    string    `gorm:"type:varchar(100)" json:"actor_name"`
	ActorEmail   string    `gorm:"type:varchar(100)" json:"actor_email"`
	Action       string    `gorm:"type:varchar(50);index;not null" json:"action"`        // e.g. deploy.create, container.restart, member.invite
	ResourceType string    `gorm:"type:varchar(50);index;not null" json:"resource_type"` // deployment, database, volume, member, token, system
	ResourceID   string    `gorm:"type:varchar(100)" json:"resource_id"`
	ResourceName string    `gorm:"type:varchar(255)" json:"resource_name"`
	Details      string    `gorm:"type:text" json:"details"`
	IPAddress    string    `gorm:"type:varchar(50)" json:"ip_address"`
	CreatedAt    time.Time `gorm:"autoCreateTime;index" json:"created_at"`
}
