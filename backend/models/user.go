package models

import (
	"time"
)

// User represents a platform user account with authentication credentials
type User struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Email        string    `gorm:"type:varchar(191);uniqueIndex;not null" json:"email"`
	PasswordHash string    `gorm:"type:varchar(255);not null" json:"-"`
	Name         string    `gorm:"type:varchar(100);not null" json:"name"`
	AvatarURL    string    `gorm:"type:varchar(255)" json:"avatar_url"`
	Role         string    `gorm:"type:varchar(50);default:'developer'" json:"role"` // admin, developer, viewer
	CreatedAt    time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt    time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}
