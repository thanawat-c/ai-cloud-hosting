package models

import "time"

// WorkspaceMember represents a member belonging to a workspace with RBAC role
type WorkspaceMember struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	WorkspaceID string    `gorm:"type:varchar(50);index;not null" json:"workspace_id"`
	Email       string    `gorm:"type:varchar(100);not null" json:"email"`
	Name        string    `gorm:"type:varchar(100)" json:"name"`
	Role        string    `gorm:"type:varchar(20);default:'member'" json:"role"` // owner, admin, member, viewer
	AvatarURL   string    `gorm:"type:varchar(255)" json:"avatar_url"`
	InvitedBy   string    `gorm:"type:varchar(100)" json:"invited_by"`
	JoinedAt    time.Time `gorm:"autoCreateTime" json:"joined_at"`
}

type InviteMemberRequest struct {
	Email string `json:"email" binding:"required,email"`
	Role  string `json:"role"` // default "member"
	Name  string `json:"name"`
}

type UpdateMemberRoleRequest struct {
	Role string `json:"role" binding:"required"`
}
