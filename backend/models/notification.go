package models

import "time"

// Notification โมเดลสำหรับเก็บประวัติแจ้งเตือนเหตุการณ์สำคัญในระบบ
type Notification struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	WorkspaceID  string    `gorm:"type:varchar(50);default:'personal';index" json:"workspace_id"`
	Title        string    `gorm:"type:varchar(255);not null" json:"title"`
	Message      string    `gorm:"type:text;not null" json:"message"`
	Type         string    `gorm:"type:varchar(30);default:'info'" json:"type"` // success, error, warning, info
	ResourceName string    `gorm:"type:varchar(100)" json:"resource_name"`
	IsRead       bool      `gorm:"default:false" json:"is_read"`
	CreatedAt    time.Time `gorm:"autoCreateTime" json:"created_at"`
}
